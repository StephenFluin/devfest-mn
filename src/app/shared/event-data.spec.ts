import { Session } from './data.service';
import { centralUtcOffset, eventUtcOffset, sessionEnd, withOffset } from './event-data';

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
