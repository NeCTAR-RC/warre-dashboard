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

from django.contrib.humanize.templatetags import humanize as humanize_filters
from django.urls import reverse
from django.urls import reverse_lazy
from django.utils.translation import pgettext_lazy
from django.utils.translation import ugettext_lazy as _
from horizon import exceptions
from horizon import forms
from horizon import tables
from horizon.utils import memoized
from horizon import views
from openstack_dashboard.usage import quotas
from openstack_dashboard.usage import views as usage_views

from warre_dashboard.api import reservation as api
from warre_dashboard.content.reservation import forms as reservation_forms
from warre_dashboard.content.reservation import tables as reservation_tables


INDEX_URL = "horizon:project:reservations:index"


class IndexView(tables.DataTableView):
    page_title = 'Reservations'
    table_class = reservation_tables.ReservationTable
    template_name = 'reservation/index.html'

    def get_data(self):
        return api.reservation_list(self.request)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['limits'] = api.limits(self.request)
        return context


class DetailView(views.HorizonTemplateView):

    page_title = "{{ reservation.id }}"
    template_name = 'reservation/detail.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['reservation'] = self.get_data()
        return context

    @memoized.memoized_method
    def get_data(self):
        try:
            reservation_id = self.kwargs['reservation_id']
            reservation = api.reservation_get(self.request, reservation_id)
        except Exception:
            exceptions.handle(self.request,
                              'Unable to retrieve reservation details.',
                              redirect=reverse(INDEX_URL))
        return reservation


CHART_DEFS = [
    {
        'title': _("Reservations"),
        'charts': [
            usage_views.ChartDef("days", _("Days"), None, None),
            usage_views.ChartDef("reservation", _("Reservations"), None, None),
        ],
    }
]

QUOTA_LIMIT_MAP = {
    'reservation': {
        'limit': 'maxReservations',
        'usage': 'totalReservationsUsed'
    },
    'days': {
        'limit': 'maxDays',
        'usage': 'totalDaysUsed'
    },
}


def get_quota_usages(request):
    usages = quotas.QuotaUsage()
    limits = api.limits(request)
    for quota_name, limit_keys in QUOTA_LIMIT_MAP.items():
        if limit_keys['usage']:
            usage = limits[limit_keys['usage']]
        else:
            usage = None
        quotas._add_limit_and_usage(usages, quota_name,
                                    limits[limit_keys['limit']],
                                    usage,
                                    [])
    return usages


class CreateView(forms.ModalFormView):
    form_class = reservation_forms.CreateForm
    template_name = 'reservation/create.html'
    submit_label = "Create Reservation"
    submit_url = reverse_lazy("horizon:project:reservations:create")
    success_url = reverse_lazy('horizon:project:reservations:index')
    page_title = "Create Reservation"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        limits = api.limits(self.request)
        context['limits'] = limits
        context['percentage_used'] = \
            limits['totalHoursUsed'] / limits['maxHours'] * 100
        flavors = api.flavor_list(self.request)
        context['availability_zones'] = list(set(
            [f.availability_zone for f in flavors if f.availability_zone]))
        context['categories'] = list(set(
            [f.category for f in flavors if f.category]))
        context['charts'] = self._get_charts_data()
        return context

    def _get_charts_data(self):
        self.usage = get_quota_usages(self.request)
        chart_sections = []
        for section in CHART_DEFS:
            chart_data = self._process_chart_section(section['charts'])
            chart_sections.append({
                'title': section['title'],
                'charts': chart_data
            })
        return chart_sections

    def _process_chart_section(self, chart_defs):
        charts = []
        for t in chart_defs:
            key = t.quota_key
            used = self.usage[key]['used']
            quota = self.usage[key]['quota']
            text = t.used_phrase
            if text is None:
                text = pgettext_lazy('Label in the limit summary', 'Used')

            filters = t.filters
            if filters is None:
                filters = (humanize_filters.intcomma,)
            used_display = usage_views._apply_filters(used, filters)
            # When quota is float('inf'), we don't show quota
            # so filtering is unnecessary.
            quota_display = None
            if quota != float('inf'):
                quota_display = usage_views._apply_filters(quota, filters)
            else:
                quota_display = quota

            charts.append({
                'type': key,
                'name': t.label,
                'used': used,
                'quota': quota,
                'used_display': used_display,
                'quota_display': quota_display,
                'text': text
            })
        return charts
