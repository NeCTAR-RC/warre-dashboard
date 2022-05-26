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

from django.urls import reverse
from django.urls import reverse_lazy
from horizon import exceptions
from horizon import forms
from horizon import tables
from horizon.utils import memoized
from horizon import views

from warre_dashboard.api import reservation as api
from warre_dashboard.content.reservation import forms as reservation_forms
from warre_dashboard.content.reservation import tables as reservation_tables


INDEX_URL = "horizon:project:reservations:index"


class IndexView(tables.DataTableView):
    page_title = 'Reservations'
    table_class = reservation_tables.ReservationTable

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


class CreateView(forms.ModalFormView):
    form_class = reservation_forms.CreateForm
    template_name = 'reservation/create.html'
    submit_label = "Create Reservation"
    submit_url = reverse_lazy("horizon:project:reservations:create")
    success_url = reverse_lazy('horizon:project:reservations:index')
    page_title = "Create Reservation"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['limits'] = api.limits(self.request)
        return context
