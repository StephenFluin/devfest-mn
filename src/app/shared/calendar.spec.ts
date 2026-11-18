import { environment } from '../../environments/environment';
import { calendarEvent, CalendarEvent, googleCalendarUrl, icsFile } from './calendar';
import { Session } from './data.service';
import { eventUtcOffset } from './event-data';

const event: CalendarEvent = {
  uid: 'abc123@devfest.mn',
  title: 'Agents, tools; and you',
  start: new Date('2026-12-05T13:40:00-06:00'),
  end: new Date('2026-12-05T14:20:00-06:00'),
  location: 'Schulze 127, University of St. Thomas',
  description: 'First line.\n\nhttps://devfest.mn/schedule/abc123/agents',
  url: 'https://devfest.mn/schedule/abc123/agents',
};
const now = new Date('2026-11-17T12:00:00Z');

/** The file's lines with folded ones joined back together, as a calendar app reads them. */
const unfolded = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

describe('icsFile', () => {
  it('writes one event with its times in UTC', () => {
    const lines = unfolded(icsFile(event, now));
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('UID:abc123@devfest.mn');
    expect(lines).toContain('DTSTAMP:20261117T120000Z');
    expect(lines).toContain('DTSTART:20261205T194000Z');
    expect(lines).toContain('DTEND:20261205T202000Z');
    expect(lines).toContain('URL:https://devfest.mn/schedule/abc123/agents');
    expect(lines.slice(-3)).toEqual(['END:VEVENT', 'END:VCALENDAR', '']);
  });

  it('escapes commas, semicolons, backslashes and line breaks in text', () => {
    const lines = unfolded(icsFile({ ...event, description: 'a\\b; c, d\r\ne\nf' }, now));
    expect(lines).toContain('SUMMARY:Agents\\, tools\\; and you');
    expect(lines).toContain('LOCATION:Schulze 127\\, University of St. Thomas');
    expect(lines).toContain('DESCRIPTION:a\\\\b\\; c\\, d\\ne\\nf');
  });

  it('ends every line with CRLF and never a bare line feed', () => {
    const ics = icsFile(event, now);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('folds long lines to 75 bytes without splitting a character', () => {
    // é is two bytes and 🎉 four, so a fold by characters would overrun or cut one in half.
    const description = `${'é'.repeat(60)} ${'🎉'.repeat(30)} ${'x'.repeat(200)}`;
    const ics = icsFile({ ...event, description }, now);
    const bytes = (line: string) => new TextEncoder().encode(line).length;
    for (const line of ics.split('\r\n')) {
      expect(bytes(line)).toBeLessThanOrEqual(75);
    }
    expect(unfolded(ics)).toContain(`DESCRIPTION:${description}`);
  });
});

describe('googleCalendarUrl', () => {
  it('prefills the event with its UTC start and end and the Minneapolis time zone', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(`${url.origin}${url.pathname}`).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Agents, tools; and you',
      dates: '20261205T194000Z/20261205T202000Z',
      details: event.description,
      location: event.location,
      ctz: 'America/Chicago',
    });
  });
});

describe('calendarEvent', () => {
  const at = (time: string) => `${environment.eventDate}T${time}${eventUtcOffset}`;
  const talk: Session = {
    $key: 'abc123',
    title: 'Agents and You',
    startTime: at('13:40'),
    room: 'Schulze 127',
    description: 'All about **agents**.',
  };
  const next: Session = {
    $key: 'next',
    title: 'Next',
    startTime: at('14:20'),
    room: 'Schulze 127',
  };

  it('is null until the schedule is announced', () => {
    expect(calendarEvent(talk, [talk, next], false)).toBeNull();
  });

  it('is null for a session with no title or no time yet', () => {
    expect(calendarEvent({ ...talk, startTime: undefined }, [talk], true)).toBeNull();
    expect(calendarEvent({ ...talk, title: '' }, [talk], true)).toBeNull();
  });

  it('runs from the session start to the next session in its room', () => {
    const event = calendarEvent(talk, [talk, next], true);
    expect(event.start.toISOString()).toBe(new Date(at('13:40')).toISOString());
    expect(event.end.toISOString()).toBe(new Date(at('14:20')).toISOString());
  });

  it('names the room and venue, and links back to the session page', () => {
    const url = `${environment.siteUrl}/schedule/abc123/agents-and-you`;
    expect(calendarEvent(talk, [talk], true)).toMatchObject({
      uid: 'abc123@devfest.mn',
      title: `Agents and You · DevFestMN ${environment.year}`,
      location: `Schulze 127, ${environment.venueName}, ${environment.venueAddress}`,
      description: `All about agents.\n\n${url}`,
      url,
    });
  });
});
