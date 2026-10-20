import { environment } from '../../environments/environment';
import { Session } from './data.service';
import { sessionUrl, withOffset } from './event-data';
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

const HOUR = 3_600_000;

/**
 * A session runs one hour per block, or until the next session in its room (or the next session
 * for everyone) starts, whichever is sooner. Null if it has no start time yet.
 */
export function calendarEvent(session: Session, schedule: Session[]): CalendarEvent | null {
    if (!session.title || !session.startTime) return null;
    const start = new Date(withOffset(session.startTime));
    if (isNaN(start.getTime())) return null;
    const sharesRoom = (other: Session) =>
        other.track === 'all' || session.track === 'all' || other.room === session.room;
    const nextStart = Math.min(
        ...schedule
            .filter((other) => other.$key !== session.$key && other.startTime && sharesRoom(other))
            .map((other) => new Date(withOffset(other.startTime)).getTime())
            .filter((time) => time > start.getTime())
    );
    const end = new Date(Math.min(start.getTime() + (session.blocks || 1) * HOUR, nextStart));
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

/** 20261205T150000Z */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

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
