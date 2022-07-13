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

from django.forms import ValidationError
from django.urls import reverse
from horizon import exceptions
from horizon import forms
from horizon import messages

from warre_dashboard.api import reservation as api


class CreateForm(forms.SelfHandlingForm):
    start = forms.DateTimeField()
    end = forms.DateTimeField()
    flavor = forms.ThemableChoiceField()

    def _populate_flavor_choices(self, request):
        try:
            flavors = api.flavor_list(request)
        except Exception:
            redirect = reverse("horizon:project:reservations:index")
            exceptions.handle(request,
                              'Unable to retrieve flavor list.',
                              redirect=redirect)

        flavor_choices = [(f.id, f.name or f.id) for f in flavors]
        self.fields['flavor'].choices = flavor_choices

    def __init__(self, request, *args, **kwargs):
        super().__init__(request, *args, **kwargs)
        self._populate_flavor_choices(request)

    def handle(self, request, data):
        try:
            reservation = api.reservation_create(
                request,
                start=data['start'],
                end=data['end'],
                instance_count=1,
                flavor_id=data['flavor'])
            message = 'Creating reservation "%s"' % reservation.id
            messages.info(request, message)
            return reservation
        except ValidationError as e:
            self.api_error(e.messages[0])
            return False
        except Exception:
            redirect = reverse("horizon:project:reservations:create")
            exceptions.handle(request,
                              "Unable to create reservation.",
                              redirect=redirect)
