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

from django.conf import settings
from horizon.utils.memoized import memoized
from keystoneauth1.identity.v3 import Token
from keystoneauth1 import session

from warreclient import client


@memoized
def warreclient(request, version='1'):
    """Initialization of Warre client."""
    auth_url = getattr(settings, 'OPENSTACK_KEYSTONE_URL', None)
    auth = Token(
        auth_url,
        token=request.user.token.id,
        project_id=request.user.project_id,
        domain_id=request.user.domain_id,
    )
    keystone_session = session.Session(auth=auth)

    return client.Client(version, session=keystone_session)


def reservation_create(request, flavor_id, start, end, instance_count=1):
    return warreclient(request).reservations.create(
        flavor_id=flavor_id,
        start=str(start),
        end=str(end),
        instance_count=instance_count)


def reservation_list(request):
    return warreclient(request).reservations.list()


def reservation_get(request, reservation_id):
    return warreclient(request).reservations.get(reservation_id)


def reservation_delete(request, reservation_id):
    return warreclient(request).reservations.delete(reservation_id)


def flavor_list(request, **kwargs):
    return warreclient(request).flavors.list(**kwargs)


def flavor_get(request, flavor_id):
    return warreclient(request).flavors.get(flavor_id)


def flavor_free_slots(request, flavor_id, start=None, end=None):
    return warreclient(request).flavors.free_slots(
        flavor_id, start=start, end=end)


def limits(request):
    limits = warreclient(request).limits.get().absolute

    limits_dict = {}
    for limit in limits:
        if limit.name == 'maxHours':
            limits_dict['maxDays'] = int(limit.value / 24)
        elif limit.name == 'totalHoursUsed':
            limits_dict['totalDaysUsed'] = int(limit.value / 24)
        if limit.value < 0:
            limits_dict[limit.name] = float("inf")
        else:
            limits_dict[limit.name] = limit.value
    return limits_dict
