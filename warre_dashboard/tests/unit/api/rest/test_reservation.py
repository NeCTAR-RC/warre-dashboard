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
from warre_dashboard.api.rest import reservation as rest


class WarreRestTests(test.RestAPITestCase):

    #
    # Maintenance Windows
    #
    @test.create_mocks({api: ['maintenance_window_list']})
    def test_maintenance_windows_get(self):
        request = self.mock_rest_request()
        window = mock.Mock()
        window.id = 7
        window.start = datetime.datetime(2026, 5, 1, 0, 0)
        window.end = datetime.datetime(2026, 5, 2, 0, 0)
        window.note = 'Network upgrade'
        window.flavors = [{'id': 'flv-1', 'name': 'g1.small'}]
        self.mock_maintenance_window_list.return_value = [window]

        response = rest.MaintenanceWindows().get(request)

        self.assertStatusCode(response, 200)
        self.assertEqual(
            {'windows': [{
                'id': 7,
                'start': '2026-05-01T00:00:00',
                'end': '2026-05-02T00:00:00',
                'note': 'Network upgrade',
                'flavors': [{'id': 'flv-1', 'name': 'g1.small'}],
            }]},
            response.json)
        self.mock_maintenance_window_list.assert_called_once_with(request)

    @test.create_mocks({api: ['maintenance_window_list']})
    def test_maintenance_windows_get_no_flavors(self):
        request = self.mock_rest_request()
        window = mock.Mock(spec=['id', 'start', 'end'])
        window.id = 9
        window.start = datetime.datetime(2026, 6, 1, 0, 0)
        window.end = datetime.datetime(2026, 6, 1, 4, 0)
        self.mock_maintenance_window_list.return_value = [window]

        response = rest.MaintenanceWindows().get(request)

        self.assertStatusCode(response, 200)
        self.assertEqual([], response.json['windows'][0]['flavors'])
        self.assertIsNone(response.json['windows'][0]['note'])

    @test.create_mocks({api: ['maintenance_window_list']})
    def test_maintenance_windows_get_empty(self):
        request = self.mock_rest_request()
        self.mock_maintenance_window_list.return_value = []

        response = rest.MaintenanceWindows().get(request)

        self.assertStatusCode(response, 200)
        self.assertEqual({'windows': []}, response.json)

    #
    # Flavor Slots
    #
    @test.create_mocks({api: ['flavor_list', 'flavor_free_slots']})
    def test_flavor_slots_all_get(self):
        request = self.mock_rest_request(GET={})
        flavor = mock.Mock()
        flavor.id = 'flv-1'
        flavor.to_dict.return_value = {'id': 'flv-1', 'name': 'g1.small'}
        self.mock_flavor_list.return_value = [flavor]
        self.mock_flavor_free_slots.return_value = [
            {'start': '2026-01-01', 'end': '2026-01-05'},
        ]

        response = rest.FlavorSlotsAll().get(request)

        self.assertStatusCode(response, 200)
        self.assertEqual(
            {'slots': [{
                'start': '2026-01-01',
                'end': '2026-01-05',
                'flavor': {'id': 'flv-1', 'name': 'g1.small'},
            }]},
            response.json)
        self.mock_flavor_list.assert_called_once_with(request)
        self.mock_flavor_free_slots.assert_called_once_with(
            request, 'flv-1', start=None, end=None)

    @test.create_mocks({api: ['flavor_list', 'flavor_free_slots']})
    def test_flavor_slots_all_get_with_filters(self):
        request = self.mock_rest_request(
            GET={'category': 'G1', 'availability_zone': 'melbourne-qh2',
                 'start': '2026-01-01', 'end': '2026-04-01'})
        self.mock_flavor_list.return_value = []
        self.mock_flavor_free_slots.return_value = []

        response = rest.FlavorSlotsAll().get(request)

        self.assertStatusCode(response, 200)
        self.assertEqual({'slots': []}, response.json)
        self.mock_flavor_list.assert_called_once_with(
            request, category='G1', availability_zone='melbourne-qh2')

    @test.create_mocks({api: ['flavor_get', 'flavor_free_slots']})
    def test_flavor_slots_get(self):
        request = self.mock_rest_request(GET={})
        flavor = mock.Mock()
        flavor.to_dict.return_value = {'id': 'flv-1', 'name': 'g1.small'}
        self.mock_flavor_get.return_value = flavor
        self.mock_flavor_free_slots.return_value = [
            {'start': '2026-01-01', 'end': '2026-01-05'},
        ]

        response = rest.FlavorSlots().get(request, 'flv-1')

        self.assertStatusCode(response, 200)
        self.assertEqual(
            {'slots': [{
                'start': '2026-01-01',
                'end': '2026-01-05',
                'flavor': {'id': 'flv-1', 'name': 'g1.small'},
            }]},
            response.json)
        self.mock_flavor_get.assert_called_once_with(request, 'flv-1')
        self.mock_flavor_free_slots.assert_called_once_with(
            request, 'flv-1', start=None, end=None)

    #
    # Reservation
    #
    @test.create_mocks({api: ['reservation_get']})
    def test_reservation_get(self):
        request = self.mock_rest_request()
        reservation = mock.Mock()
        reservation.to_dict.return_value = {'id': 'res-1', 'status': 'active'}
        self.mock_reservation_get.return_value = reservation

        response = rest.Reservation().get(request, 'res-1')

        self.assertStatusCode(response, 200)
        self.assertEqual({'id': 'res-1', 'status': 'active'}, response.json)
        self.mock_reservation_get.assert_called_once_with(request, 'res-1')
