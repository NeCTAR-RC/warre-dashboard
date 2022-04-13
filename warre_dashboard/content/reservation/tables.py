# Copyright 2022 Australian Research Data Commons
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging

from django import http
from django import template
from django import urls
from django.utils.text import format_lazy
from django.utils.translation import pgettext_lazy
from django.utils.translation import ugettext_lazy as _
from django.utils.translation import ungettext_lazy
from horizon import tables
from horizon.templatetags import sizeformat
from openstack_dashboard import policy

from warre_dashboard.api import reservation as api


LOG = logging.getLogger(__name__)


class DeleteReservation(policy.PolicyTargetMixin, tables.DeleteAction):
    policy_rules = (("reservation", "warre:reservation:delete"),)
    help_text = _("Deleted reservations are not recoverable.")
    default_message_level = "info"

    @staticmethod
    def action_present(count):
        return ungettext_lazy(
            "Delete Reservation",
            "Delete Reservations",
            count
        )

    @staticmethod
    def action_past(count):
        return ungettext_lazy(
            "Scheduled deletion of Reservation",
            "Scheduled deletion of Reservations",
            count
        )

    def allowed(self, request, reservation=None):
        state = True
        if reservation:
            state = (reservation.status != 'PENDING_CREATE')
        return state

    def delete(self, request, obj_id):
        api.reservation_delete(request, obj_id)


class CreateReservation(tables.LinkAction):
    name = "create"
    verbose_name = _("Create Reservation")
    url = "horizon:project:reservations:create"
    classes = ("ajax-modal", "btn-create")
    icon = "plus"
    policy_rules = (("reservation", "warre:reservation:create"),)
    ajax = True

    def __init__(self, attrs=None, **kwargs):
        kwargs['preempt'] = True
        super().__init__(attrs, **kwargs)

    def allowed(self, request, reservation=None):
        try:
            limits = api.limits(request)
            reservations_available = limits['maxReservations'] \
                - limits['totalReservationsUsed']
            hours_available = limits['maxHours'] - limits['totalHoursUsed']

            if reservations_available <= 0 or hours_available <= 0:
                if "disabled" not in self.classes:
                    self.classes = list(self.classes) + ['disabled']
                    self.verbose_name = format_lazy(
                        '{verbose_name} {quota_exceeded}',
                        verbose_name=self.verbose_name,
                        quota_exceeded=_("(Quota exceeded)"))
            else:
                self.verbose_name = _("Create Reservation")
                classes = [c for c in self.classes if c != "disabled"]
                self.classes = classes
        except Exception:
            LOG.exception("Failed to retrieve quota information")

        return True

    def single(self, table, request, object_id=None):
        self.allowed(request, None)
        return http.HttpResponse(self.render(is_table_action=True))


def get_flavor(reservation):
    flavor = reservation.flavor
    template_name = 'reservation/_reservation_flavor.html'
    size_ram = sizeformat.mb_float_format(flavor.memory_mb)
    size_disk = sizeformat.diskgbformat(flavor.disk_gb)
    context = {
        "id": reservation.id,
        "name": flavor.name,
        "vcpus": flavor.vcpu,
        "size_ram": size_ram,
        "size_disk": size_disk,
        }
    return template.loader.render_to_string(template_name, context)


def get_reservation_detail_link(obj, request):
    return urls.reverse('horizon:project:reservations:detail', args=(obj.id,))


STATUS_DISPLAY_CHOICES = (
    ("error", pgettext_lazy("Current status of an Instance", "Error")),
    ("active", pgettext_lazy("Current status of an Instance", "Active")),
    ("allocated", pgettext_lazy("Current status of an Instance", "Allocated")),
    ("complete", pgettext_lazy("Current status of an Instance", "Complete")),
    ("pending_create", pgettext_lazy("Current status of an Instance",
                                     "Pending Create")),
)


class UpdateRow(tables.Row):
    ajax = True

    def get_data(self, request, reservation_id):
        return api.reservation_get(request, reservation_id)


class ReservationTable(tables.DataTable):

    STATUS_CHOICES = (
        ("active", True),
        ("allocated", True),
        ("complete", True),
        ("error", False),
        ("pending_create", None),
    )

    id = tables.Column('id', link=get_reservation_detail_link)
    start = tables.Column('start')
    end = tables.Column('end')
    flavor = tables.Column(get_flavor, sortable=False, verbose_name="Flavor")
    status = tables.Column('status', status=True,
                           status_choices=STATUS_CHOICES,
                           display_choices=STATUS_DISPLAY_CHOICES)
    instance_count = tables.Column('instance_count',
                                   verbose_name="Instance Count")

    class Meta:
        status_columns = ['status']
        table_actions = (CreateReservation, DeleteReservation,)
        row_actions = (DeleteReservation,)
        row_class = UpdateRow
