# Copyright 2026 Australian Research Data Commons
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

import datetime
from unittest import mock

from openstack_dashboard.test import helpers as test

from warre_dashboard.api import reservation as api


class WarreApiTests(test.APIMockTestCase):

    @mock.patch.object(api, 'warreclient')
    def test_reservation_create(self, mock_warreclient):
        client = mock_warreclient.return_value
        start = datetime.datetime(2026, 1, 1, 0, 0)
        end = datetime.datetime(2026, 1, 5, 23, 59)
        client.reservations.create.return_value = mock.sentinel.reservation

        ret = api.reservation_create(self.request,
                                     flavor_id='flv-1',
                                     start=start,
                                     end=end,
                                     instance_count=2)

        self.assertEqual(mock.sentinel.reservation, ret)
        client.reservations.create.assert_called_once_with(
            flavor_id='flv-1',
            start=start.isoformat(),
            end=end.isoformat(),
            instance_count=2)

    @mock.patch.object(api, 'warreclient')
    def test_reservation_list(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.reservations.list.return_value = [mock.sentinel.r1]

        ret = api.reservation_list(self.request)

        self.assertEqual([mock.sentinel.r1], ret)
        client.reservations.list.assert_called_once_with()

    @mock.patch.object(api, 'warreclient')
    def test_reservation_get(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.reservations.get.return_value = mock.sentinel.reservation

        ret = api.reservation_get(self.request, 'res-1')

        self.assertEqual(mock.sentinel.reservation, ret)
        client.reservations.get.assert_called_once_with('res-1')

    @mock.patch.object(api, 'warreclient')
    def test_reservation_delete(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.reservations.delete.return_value = None

        ret = api.reservation_delete(self.request, 'res-1')

        self.assertIsNone(ret)
        client.reservations.delete.assert_called_once_with('res-1')

    @mock.patch.object(api, 'warreclient')
    def test_reservation_extend(self, mock_warreclient):
        client = mock_warreclient.return_value
        new_end = datetime.datetime(2026, 1, 10, 23, 59)
        client.reservations.update.return_value = mock.sentinel.reservation

        ret = api.reservation_extend(self.request, 'res-1', new_end)

        self.assertEqual(mock.sentinel.reservation, ret)
        client.reservations.update.assert_called_once_with(
            'res-1', end=new_end.isoformat())

    @mock.patch.object(api, 'warreclient')
    def test_flavor_list(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.flavors.list.return_value = [mock.sentinel.f1]

        ret = api.flavor_list(self.request, category='G1')

        self.assertEqual([mock.sentinel.f1], ret)
        client.flavors.list.assert_called_once_with(category='G1')

    @mock.patch.object(api, 'warreclient')
    def test_flavor_get(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.flavors.get.return_value = mock.sentinel.flavor

        ret = api.flavor_get(self.request, 'flv-1')

        self.assertEqual(mock.sentinel.flavor, ret)
        client.flavors.get.assert_called_once_with('flv-1')

    @mock.patch.object(api, 'warreclient')
    def test_flavor_free_slots(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.flavors.free_slots.return_value = [{'start': 's', 'end': 'e'}]

        ret = api.flavor_free_slots(self.request, 'flv-1',
                                    start='2026-01-01', end='2026-04-01')

        self.assertEqual([{'start': 's', 'end': 'e'}], ret)
        client.flavors.free_slots.assert_called_once_with(
            'flv-1', start='2026-01-01', end='2026-04-01')

    @mock.patch.object(api, 'warreclient')
    def test_maintenance_window_list(self, mock_warreclient):
        client = mock_warreclient.return_value
        client.maintenancewindows.list.return_value = [mock.sentinel.window]

        ret = api.maintenance_window_list(self.request)

        self.assertEqual([mock.sentinel.window], ret)
        client.maintenancewindows.list.assert_called_once_with()

    @mock.patch.object(api, 'warreclient')
    def test_limits(self, mock_warreclient):
        client = mock_warreclient.return_value
        absolute = [
            mock.Mock(name='maxHours', value=240),
            mock.Mock(name='totalHoursUsed', value=48),
            mock.Mock(name='maxReservations', value=-1),
        ]
        # name= kwarg is consumed by Mock itself, set explicitly
        absolute[0].name = 'maxHours'
        absolute[1].name = 'totalHoursUsed'
        absolute[2].name = 'maxReservations'
        client.limits.get.return_value = mock.Mock(absolute=absolute)

        ret = api.limits(self.request)

        self.assertEqual(240, ret['maxHours'])
        self.assertEqual(10, ret['maxDays'])
        self.assertEqual(48, ret['totalHoursUsed'])
        self.assertEqual(2, ret['totalDaysUsed'])
        self.assertEqual(float('inf'), ret['maxReservations'])
