import { environment } from '../../environments/environment';
import { Session } from './data.service';
import { eventUtcOffset, sessionEnd, sessionUrl, withOffset } from './event-data';
import { summarize } from './slug';

/**
 * Calendar entries for a session. Google Calendar gets a prefilled "new event" link; Apple Calendar
 * and Outlook get an .ics file from the server (/calendar/<key>.ics), which iOS opens straight into
 * an "Add to Calendar" sheet.
 */
export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  url: string;
}

/** A session with its start and end (see sessionEnd). Null if it has no start time yet or the schedule isn't public. */
export function calendarEvent(session: Session, schedule: Session[]): CalendarEvent | null {
  if (!environment.showSchedule || !session.title || !session.startTime) return null;
  const start = new Date(withOffset(session.startTime));
  const end = sessionEnd(session, schedule);
  if (!end) return null;
  const url = sessionUrl(session);
  const summary = session.description ? summarize(session.description, 600) : '';
  return {
    uid: `${session.$key}@devfest.mn`,
    title: `${session.title} · DevFestMN ${environment.year}`,
    start,
    end,
    location: [session.room, environment.venueName, environment.venueAddress]
      .filter(Boolean)
      .join(', '),
    description: [summary, url].filter(Boolean).join('\n\n'),
    url,
  };
}

/** The whole conference day, for people who just bought a ticket. Matches the structured data's hours. */
export function conferenceCalendarEvent(): CalendarEvent {
  return {
    uid: `devfestmn-${environment.year}@devfest.mn`,
    title: `DevFestMN ${environment.year}`,
    start: new Date(`${environment.eventDate}T09:00:00${eventUtcOffset}`),
    end: new Date(`${environment.eventDate}T17:00:00${eventUtcOffset}`),
    location: `${environment.venueName}, ${environment.venueAddress}`,
    description: `${environment.siteDescription}\n\n${environment.siteUrl}`,
    url: environment.siteUrl,
  };
}

export const conferenceIcsPath = `/calendar/devfestmn-${environment.year}.ics`;

/** 20261205T150000Z */
const utcStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcStamp(event.start)}/${utcStamp(event.end)}`,
    details: event.description,
    location: event.location,
    ctz: 'America/Chicago',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export const icsPath = (session: Session) => `/calendar/${session.$key}.ics`;

/** RFC 5545 text: escape the special characters, then fold lines longer than 75 octets. */
const icsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    // Continuation lines start with a space, which counts toward their 75.
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function icsFile(event: CalendarEvent, now = new Date()): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DevFestMN//Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(event.start)}`,
      `DTEND:${utcStamp(event.end)}`,
      `SUMMARY:${icsText(event.title)}`,
      `LOCATION:${icsText(event.location)}`,
      `DESCRIPTION:${icsText(event.description)}`,
      `URL:${event.url}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}
