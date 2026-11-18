import { environment } from '../../environments/environment';
import { Session, Speaker } from './data.service';
import {
  centralUtcOffset,
  EVENT_ID,
  eventUtcOffset,
  scheduledSessionEvents,
  sessionEnd,
  sessionEvent,
  withOffset,
} from './event-data';

describe('centralUtcOffset', () => {
  it("is Minneapolis's offset on that date, in winter and in summer time", () => {
    expect(centralUtcOffset('2026-12-05')).toBe('-06:00');
    expect(centralUtcOffset('2026-07-04')).toBe('-05:00');
  });
});

describe('withOffset', () => {
  it('leaves a time that already has a zone alone', () => {
    expect(withOffset('2026-12-05T13:40-06:00')).toBe('2026-12-05T13:40-06:00');
    expect(withOffset('2026-12-05T19:40:00Z')).toBe('2026-12-05T19:40:00Z');
  });

  it("gives an older, zoneless time the event's offset", () => {
    expect(withOffset('2026-12-05T13:40:00')).toBe(`2026-12-05T13:40:00${eventUtcOffset}`);
  });

  it('adds the seconds a date needs before its offset', () => {
    expect(withOffset('2026-12-05T13:40')).toBe(`2026-12-05T13:40:00${eventUtcOffset}`);
  });
});

describe('sessionEnd', () => {
  const at = (time: string) => `2026-12-05T${time}-06:00`;
  const talk = (
    $key: string,
    time: string | undefined,
    room: string,
    more: Partial<Session> = {},
  ): Session => ({ $key, title: $key, room, startTime: time && at(time), ...more });
  const ends = (session: Session, schedule: Session[]) =>
    sessionEnd(session, schedule)?.toISOString();
  const iso = (time: string) => new Date(at(time)).toISOString();

  it('is an hour after the start when nothing follows', () => {
    const only = talk('only', '16:40', 'Auditorium');
    expect(ends(only, [only])).toBe(iso('17:40'));
  });

  it('is an hour per block', () => {
    const workshop = talk('workshop', '13:00', 'Schulze 127', { blocks: 2 });
    expect(ends(workshop, [workshop])).toBe(iso('15:00'));
  });

  it('is when the next session in the same room starts, if that is sooner', () => {
    const first = talk('first', '09:15', 'Auditorium');
    const next = talk('next', '09:55', 'Auditorium');
    const later = talk('later', '10:35', 'Auditorium');
    expect(ends(first, [later, next, first])).toBe(iso('09:55'));
  });

  it("isn't cut short by a session in another room", () => {
    const first = talk('first', '09:15', 'Auditorium');
    const elsewhere = talk('elsewhere', '09:55', 'Schulze 127');
    expect(ends(first, [first, elsewhere])).toBe(iso('10:15'));
  });

  it('is cut short by a session for everyone, whatever its room', () => {
    const last = talk('last', '16:40', 'Schulze 127');
    const closing = talk('closing', '17:20', 'Auditorium', { track: 'all' });
    expect(ends(last, [last, closing])).toBe(iso('17:20'));
  });

  it('ends a session for everyone when any room starts its next session', () => {
    const welcome = talk('welcome', '09:00', 'Auditorium', { track: 'all' });
    const first = talk('first', '09:15', 'Schulze 127');
    expect(ends(welcome, [welcome, first])).toBe(iso('09:15'));
  });

  it('ignores sessions that start at the same time or have no time yet', () => {
    const first = talk('first', '09:15', 'Auditorium');
    const clash = talk('clash', '09:15', 'Auditorium');
    const unscheduled = talk('unscheduled', undefined, 'Auditorium');
    expect(ends(first, [first, clash, unscheduled])).toBe(iso('10:15'));
  });

  it('is null without a start time, or with one that is not a date', () => {
    expect(sessionEnd(talk('unscheduled', undefined, 'Auditorium'), [])).toBeNull();
    expect(sessionEnd({ $key: 'bad', startTime: 'tomorrow-ish' }, [])).toBeNull();
  });
});

describe('sessionEvent', () => {
  const at = (time: string) => `${environment.eventDate}T${time}${eventUtcOffset}`;
  const speakers: Record<string, Speaker> = {
    jane: { $key: 'jane', name: 'Jane Doe', published: true },
    hidden: { $key: 'hidden', name: 'Not Yet', published: false },
  };
  const lookup = (key: string) => speakers[key];
  const talk: Session = {
    $key: 'abc123',
    title: 'Agents and You',
    startTime: at('13:40'),
    room: 'Schulze 127',
    speakers: { a: 'jane', b: 'hidden', c: 'gone' },
  };
  const next: Session = {
    $key: 'next',
    title: 'Next',
    startTime: at('14:20'),
    room: 'Schulze 127',
  };

  it('is null until the schedule is announced', () => {
    expect(sessionEvent(talk, [talk, next], lookup, { showSchedule: false })).toBeNull();
  });

  it('is null for a session with no title or no time yet', () => {
    const announced = { showSchedule: true };
    expect(sessionEvent({ ...talk, startTime: undefined }, [talk], lookup, announced)).toBeNull();
    expect(sessionEvent({ ...talk, title: undefined }, [talk], lookup, announced)).toBeNull();
  });

  it('describes the session with its times in Minneapolis time and its room at the venue', () => {
    const event = sessionEvent(talk, [talk, next], lookup, { showSchedule: true });
    expect(event).toMatchObject({
      '@type': 'Event',
      '@id': `${environment.siteUrl}/schedule/abc123/agents-and-you#event`,
      name: 'Agents and You',
      startDate: at('13:40'),
      endDate: `${environment.eventDate}T14:20:00${eventUtcOffset}`,
      location: { '@type': 'Place', name: 'Schulze 127' },
    });
  });

  it('names only published speakers as performers', () => {
    const event = sessionEvent(talk, [talk], lookup, { showSchedule: true });
    expect(event.performer).toEqual([
      {
        '@type': 'Person',
        name: 'Jane Doe',
        url: `${environment.siteUrl}/speakers/jane/jane-doe`,
      },
    ]);
  });

  it('points back to the conference only on its own page', () => {
    const nested = sessionEvent(talk, [talk], lookup, { showSchedule: true });
    const own = sessionEvent(talk, [talk], lookup, { showSchedule: true, standalone: true });
    expect(nested).not.toHaveProperty('superEvent');
    expect(own.superEvent).toMatchObject({ '@id': EVENT_ID });
  });
});

describe('scheduledSessionEvents', () => {
  const at = (time: string) => `${environment.eventDate}T${time}${eventUtcOffset}`;
  const first: Session = { $key: 'a', title: 'First', startTime: at('09:15'), room: 'Auditorium' };
  const second: Session = {
    $key: 'b',
    title: 'Second',
    startTime: at('09:55'),
    room: 'Auditorium',
  };
  const unscheduled: Session = { $key: 'c', title: 'Someday', room: 'Auditorium' };
  const names = (sessions: Session[], showSchedule = true) =>
    scheduledSessionEvents(sessions, () => undefined, showSchedule).map((event) => event.name);

  it('lists sessions in schedule order', () => {
    expect(names([second, first])).toEqual(['First', 'Second']);
  });

  it('leaves out a session with no time yet', () => {
    expect(names([first, unscheduled])).toEqual(['First']);
  });

  // Known bug: the sort compares start times before the untimed sessions are dropped, and a missing
  // time compares as "equal" to everything, so the sessions either side of one are never compared
  // with each other. Remove `.fails` once scheduledSessionEvents drops them before sorting.
  it.fails(
    'keeps schedule order when a session with no time is listed between two with one',
    () => {
      expect(names([second, unscheduled, first])).toEqual(['First', 'Second']);
    },
  );

  it('is empty until the schedule is announced', () => {
    expect(names([first, second], false)).toEqual([]);
  });
});
