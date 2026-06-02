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
from warre_dashboard.content.reservation import views


def _limits_fixture():
    return {
        'maxHours': 240,
        'maxDays': 10,
        'totalHoursUsed': 48,
        'totalDaysUsed': 2,
        'maxReservations': 5,
        'totalReservationsUsed': 1,
    }


class IndexViewTests(test.TestCase):

    @test.create_mocks({api: ['reservation_list', 'limits']})
    def test_get_data(self):
        self.mock_reservation_list.return_value = [mock.sentinel.reservation]

        view = views.IndexView()
        view.request = self.request

        self.assertEqual([mock.sentinel.reservation], view.get_data())
        self.mock_reservation_list.assert_called_once_with(self.request)

    @test.create_mocks({api: ['limits']})
    def test_get_context_data_includes_limits(self):
        limits = _limits_fixture()
        self.mock_limits.return_value = limits

        view = views.IndexView()
        view.request = self.request
        view.kwargs = {}
        view.object_list = []

        context = view.get_context_data()
        self.assertEqual(limits, context['limits'])
        self.mock_limits.assert_called_once_with(self.request)


class DetailViewTests(test.TestCase):

    @test.create_mocks({api: ['reservation_get']})
    def test_get_data(self):
        reservation = mock.Mock(id='res-1')
        self.mock_reservation_get.return_value = reservation

        view = views.DetailView()
        view.request = self.request
        view.kwargs = {'reservation_id': 'res-1'}

        self.assertEqual(reservation, view.get_data())
        self.mock_reservation_get.assert_called_once_with(
            self.request, 'res-1')

    @test.create_mocks({api: ['reservation_get']})
    def test_get_data_handles_exception(self):
        self.mock_reservation_get.side_effect = ValueError('boom')

        view = views.DetailView()
        view.request = self.request
        view.kwargs = {'reservation_id': 'res-1'}

        # In production exceptions.handle raises an Http302 redirect; mock it
        # to do the same so the view doesn't fall through.
        redirect = ValueError('redirect')
        with mock.patch.object(views.exceptions, 'handle',
                               side_effect=redirect) as mock_handle:
            self.assertRaises(ValueError, view.get_data)
        mock_handle.assert_called_once()


class CreateViewTests(test.TestCase):

    @test.create_mocks({api: ['limits', 'flavor_list']})
    def test_get_context_data(self):
        self.mock_limits.return_value = _limits_fixture()
        flavor = mock.Mock(availability_zone='melbourne-qh2', category='G1')
        self.mock_flavor_list.return_value = [flavor]

        view = views.CreateView()
        view.request = self.request
        view.kwargs = {}

        context = view.get_context_data()

        self.assertEqual(_limits_fixture(), context['limits'])
        self.assertEqual(['melbourne-qh2'], context['availability_zones'])
        self.assertEqual(['G1'], context['categories'])
        self.assertIn('charts', context)
        self.assertIn('start_time', context)
        self.assertIn('end_time', context)
        # 48 hours used / 240 max = 20%
        self.assertEqual(20.0, context['percentage_used'])

    @test.create_mocks({api: ['limits', 'flavor_list']})
    def test_get_context_data_filters_empty_az_and_category(self):
        self.mock_limits.return_value = _limits_fixture()
        flavor_with_az = mock.Mock(availability_zone='melbourne-qh2',
                                   category='G1')
        flavor_no_az = mock.Mock(availability_zone=None, category=None)
        self.mock_flavor_list.return_value = [flavor_with_az, flavor_no_az]

        view = views.CreateView()
        view.request = self.request
        view.kwargs = {}

        context = view.get_context_data()
        self.assertEqual(['melbourne-qh2'], context['availability_zones'])
        self.assertEqual(['G1'], context['categories'])


class ExtendViewTests(test.TestCase):

    @test.create_mocks({api: ['reservation_get']})
    def test_get_initial(self):
        end = datetime.datetime(2026, 6, 1, 23, 59)
        reservation = mock.Mock(id='res-1', end=end)
        self.mock_reservation_get.return_value = reservation

        view = views.ExtendView()
        view.request = self.request
        view.kwargs = {'reservation_id': 'res-1'}

        initial = view.get_initial()
        self.assertEqual({'id': 'res-1', 'orig_end': end}, initial)
        self.mock_reservation_get.assert_called_once_with(
            self.request, 'res-1')
