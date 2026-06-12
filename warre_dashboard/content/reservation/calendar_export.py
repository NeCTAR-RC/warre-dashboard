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
import urllib.parse

import icalendar


# Statuses for which adding the reservation to a calendar makes sense:
# PENDING_CREATE may still fail and ERROR/COMPLETE have nothing to attend.
CALENDAR_STATUSES = ('ACTIVE', 'ALLOCATED')

GOOGLE_DATE_FORMAT = '%Y%m%dT%H%M%SZ'
OUTLOOK_DATE_FORMAT = '%Y-%m-%dT%H:%M:%SZ'


def to_utc(dt):
    """Normalise a reservation datetime to an aware UTC datetime.

    warreclient parses offset-less API timestamps (UTC by Warre
    convention) into naive datetimes, but offset-bearing ones into
    aware local-time datetimes.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def _summary(reservation):
    return f"Nectar reservation: {reservation.flavor.name}"


def _description(reservation, detail_url):
    return (f"Nectar reservation {reservation.id} "
            f"({reservation.flavor.name}).\n"
            f"Reservation details: {detail_url}")


def generate_ics(reservation, detail_url, host):
    """Serialise a reservation as an iCalendar (RFC 5545) document."""
    cal = icalendar.Calendar()
    cal.add('prodid',
            '-//Australian Research Data Commons'
            '//Nectar Reservation Service//EN')
    cal.add('version', '2.0')

    event = icalendar.Event()
    # Deterministic UID so a re-downloaded reservation (e.g. after an
    # extension) updates the existing calendar event instead of
    # duplicating it.
    event.add('uid', f'nectar-reservation-{reservation.id}@{host}')
    event.add('dtstamp', datetime.datetime.now(datetime.timezone.utc))
    event.add('dtstart', to_utc(reservation.start))
    event.add('dtend', to_utc(reservation.end))
    event.add('summary', _summary(reservation))
    event.add('description', _description(reservation, detail_url))
    event.add('url', detail_url)

    alarm = icalendar.Alarm()
    alarm.add('action', 'DISPLAY')
    alarm.add('description', 'Nectar reservation starts in 1 hour')
    alarm.add('trigger', datetime.timedelta(hours=-1))
    event.add_component(alarm)

    cal.add_component(event)
    return cal.to_ical()


def google_calendar_url(reservation, detail_url):
    """Build a Google Calendar event template link."""
    params = {
        'action': 'TEMPLATE',
        'text': _summary(reservation),
        'dates': '{}/{}'.format(
            to_utc(reservation.start).strftime(GOOGLE_DATE_FORMAT),
            to_utc(reservation.end).strftime(GOOGLE_DATE_FORMAT)),
        'details': _description(reservation, detail_url),
    }
    query = urllib.parse.urlencode(params)
    return f'https://calendar.google.com/calendar/render?{query}'


def outlook_calendar_url(reservation, detail_url, personal=False):
    """Build an Outlook web "compose event" deep link.

    Microsoft work/school accounts live on outlook.office.com and
    personal accounts on outlook.live.com; the path and parameters
    are identical.
    """
    host = 'outlook.live.com' if personal else 'outlook.office.com'
    params = {
        'path': '/calendar/action/compose',
        'rru': 'addevent',
        'subject': _summary(reservation),
        'startdt': to_utc(reservation.start).strftime(OUTLOOK_DATE_FORMAT),
        'enddt': to_utc(reservation.end).strftime(OUTLOOK_DATE_FORMAT),
        'body': _description(reservation, detail_url),
    }
    query = urllib.parse.urlencode(params)
    return f'https://{host}/calendar/0/deeplink/compose?{query}'
