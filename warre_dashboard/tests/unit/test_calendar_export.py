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
import urllib.parse

import icalendar
from openstack_dashboard.test import helpers as test

from warre_dashboard.content.reservation import calendar_export


UTC = datetime.timezone.utc

DETAIL_URL = 'http://testserver/project/reservations/res-1/'


def _reservation_fixture(status='ACTIVE'):
    flavor = mock.Mock()
    flavor.name = 'GPU A100'
    return mock.Mock(
        id='res-1',
        status=status,
        start=datetime.datetime(2026, 6, 15, 1, 0),
        end=datetime.datetime(2026, 6, 17, 1, 0),
        flavor=flavor)


class ToUtcTests(test.TestCase):

    def test_naive_datetime_assumed_utc(self):
        naive = datetime.datetime(2026, 6, 15, 1, 0)
        self.assertEqual(
            datetime.datetime(2026, 6, 15, 1, 0, tzinfo=UTC),
            calendar_export.to_utc(naive))

    def test_aware_datetime_converted_to_utc(self):
        aest = datetime.timezone(datetime.timedelta(hours=10))
        aware = datetime.datetime(2026, 6, 15, 11, 0, tzinfo=aest)
        self.assertEqual(
            datetime.datetime(2026, 6, 15, 1, 0, tzinfo=UTC),
            calendar_export.to_utc(aware))


class GenerateIcsTests(test.TestCase):

    def test_generate_ics(self):
        reservation = _reservation_fixture()

        ics = calendar_export.generate_ics(
            reservation, DETAIL_URL, 'testserver')

        cal = icalendar.Calendar.from_ical(ics)
        events = [c for c in cal.subcomponents if c.name == 'VEVENT']
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('nectar-reservation-res-1@testserver',
                         str(event['UID']))
        self.assertEqual(datetime.datetime(2026, 6, 15, 1, 0, tzinfo=UTC),
                         event['DTSTART'].dt)
        self.assertEqual(datetime.datetime(2026, 6, 17, 1, 0, tzinfo=UTC),
                         event['DTEND'].dt)
        self.assertEqual('Nectar reservation: GPU A100',
                         str(event['SUMMARY']))
        self.assertIn(DETAIL_URL, str(event['DESCRIPTION']))
        self.assertEqual(DETAIL_URL, str(event['URL']))

    def test_generate_ics_includes_reminder(self):
        reservation = _reservation_fixture()

        ics = calendar_export.generate_ics(
            reservation, DETAIL_URL, 'testserver')

        cal = icalendar.Calendar.from_ical(ics)
        event = [c for c in cal.subcomponents if c.name == 'VEVENT'][0]
        alarms = [c for c in event.subcomponents if c.name == 'VALARM']
        self.assertEqual(1, len(alarms))
        self.assertEqual('DISPLAY', str(alarms[0]['ACTION']))
        self.assertEqual(datetime.timedelta(hours=-1),
                         alarms[0]['TRIGGER'].dt)


class CalendarUrlTests(test.TestCase):

    def test_google_calendar_url(self):
        reservation = _reservation_fixture()

        url = calendar_export.google_calendar_url(reservation, DETAIL_URL)

        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        self.assertEqual('calendar.google.com', parsed.netloc)
        self.assertEqual(['TEMPLATE'], params['action'])
        self.assertEqual(['Nectar reservation: GPU A100'], params['text'])
        self.assertEqual(['20260615T010000Z/20260617T010000Z'],
                         params['dates'])
        self.assertIn(DETAIL_URL, params['details'][0])

    def test_outlook_calendar_url_work(self):
        reservation = _reservation_fixture()

        url = calendar_export.outlook_calendar_url(reservation, DETAIL_URL)

        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        self.assertEqual('outlook.office.com', parsed.netloc)
        self.assertEqual(['addevent'], params['rru'])
        self.assertEqual(['Nectar reservation: GPU A100'], params['subject'])
        self.assertEqual(['2026-06-15T01:00:00Z'], params['startdt'])
        self.assertEqual(['2026-06-17T01:00:00Z'], params['enddt'])
        self.assertIn(DETAIL_URL, params['body'][0])

    def test_outlook_calendar_url_personal(self):
        reservation = _reservation_fixture()

        url = calendar_export.outlook_calendar_url(
            reservation, DETAIL_URL, personal=True)

        self.assertEqual('outlook.live.com',
                         urllib.parse.urlparse(url).netloc)
