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

from unittest import mock

from openstack_dashboard.test import helpers as test

from warre_dashboard.content.reservation import tables


class AddToCalendarTests(test.TestCase):

    def test_allowed_for_current_reservations(self):
        action = tables.AddToCalendar()
        for status in ('ACTIVE', 'ALLOCATED'):
            reservation = mock.Mock(status=status)
            self.assertTrue(action.allowed(self.request, reservation),
                            f'expected allowed for {status}')

    def test_not_allowed_for_other_statuses(self):
        action = tables.AddToCalendar()
        for status in ('PENDING_CREATE', 'ERROR', 'COMPLETE'):
            reservation = mock.Mock(status=status)
            self.assertFalse(action.allowed(self.request, reservation),
                             f'expected not allowed for {status}')

    def test_not_allowed_without_reservation(self):
        action = tables.AddToCalendar()
        self.assertFalse(action.allowed(self.request, None))
