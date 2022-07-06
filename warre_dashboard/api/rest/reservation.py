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
"""Rest API over the warre api
"""

from django.views import generic

from openstack_dashboard.api.rest import urls
from openstack_dashboard.api.rest import utils as rest_utils

from warre_dashboard.api import reservation as api


@urls.register
class FlavorSlots(generic.View):
    """API for Flavor Free slots.

    """
    url_regex = r'warre/flavor-slots/$'

    @rest_utils.ajax()
    def get(self, request):
        """List flavors and their free slots

        """
        category = request.GET.get('category')
        az = request.GET.get('availability_zone')
        start = request.GET.get('start')
        end = request.GET.get('end')
        opts = {}
        if category:
            opts['category'] = category
        if az:
            opts['availability_zone'] = az

        flavors = api.flavor_list(request, **opts)
        total_slots = []
        for flavor in flavors:
            slots = api.flavor_free_slots(request, flavor.id,
                                          start=start, end=end)
            for slot in slots:
                slot['flavor'] = flavor.to_dict()
                total_slots.append(slot)
        return {'slots': total_slots}
