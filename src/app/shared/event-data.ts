import { environment } from '../../environments/environment';
import { Session, Speaker } from './data.service';
import { slugify, summarize } from './slug';

/**
 * schema.org structured data for the conference and its sessions. Every page describes the conference
 * the same way and with the same @id, so search engines treat the home page, schedule, sessions,
 * and speakers as one event: the home page lists its speakers, the schedule its sessions (subEvent),
 * and each session and speaker page points back to it.
 */
export const EVENT_ID = `${environment.siteUrl}/#event`;

/** Minneapolis's UTC offset on a YYYY-MM-DD date, e.g. "-06:00" (or "-05:00" in summer time). */
export const centralUtcOffset = (date: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')
    .value.replace('GMT', '');

/** Minneapolis's UTC offset on the event date, e.g. "-06:00". */
export const eventUtcOffset = centralUtcOffset(environment.eventDate);

/** A session start time with its time zone; older sessions were saved without one. */
export const withOffset = (time: string) =>
  /(Z|[+-]\d\d:\d\d)$/.test(time)
    ? time
    : `${time.length === 16 ? `${time}:00` : time}${eventUtcOffset}`;

/** A moment as Minneapolis time on the event date, e.g. "2026-12-05T10:00:00-06:00". */
const inEventZone = (date: Date) => {
  const [hours, minutes] = eventUtcOffset.split(':').map(Number);
  const offset = (hours * 60 + Math.sign(hours) * minutes) * 60_000;
  return `${new Date(date.getTime() + offset).toISOString().slice(0, 19)}${eventUtcOffset}`;
};

const HOUR = 3_600_000;

/**
 * A session runs one hour per block, or until the next session in its room (or the next session
 * for everyone) starts, whichever is sooner. Null if it has no start time yet.
 */
export function sessionEnd(session: Session, schedule: Session[]): Date | null {
  if (!session.startTime) return null;
  const start = new Date(withOffset(session.startTime)).getTime();
  if (isNaN(start)) return null;
  const sharesRoom = (other: Session) =>
    other.track === 'all' || session.track === 'all' || other.room === session.room;
  const nextStart = Math.min(
    ...schedule
      .filter((other) => other.$key !== session.$key && other.startTime && sharesRoom(other))
      .map((other) => new Date(withOffset(other.startTime)).getTime())
      .filter((time) => time > start),
  );
  return new Date(Math.min(start + (session.blocks || 1) * HOUR, nextStart));
}

const venue = {
  '@type': 'Place',
  name: environment.venueName,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '46 S 11th St',
    addressLocality: 'Minneapolis',
    postalCode: '55403',
    addressRegion: 'MN',
    addressCountry: 'US',
  },
};

/** A conference ticket is what gets you into any session, so sessions offer the same ticket. */
const tickets = environment.showRegister && {
  offers: {
    '@type': 'Offer',
    url: `https://www.eventbrite.com/e/${environment.eventbriteEventId}`,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
};

const organizer = {
  '@type': 'Organization',
  name: 'GDG Twin Cities',
  url: 'https://gdg.community.dev/gdg-twin-cities/',
};

export const speakerUrl = (speaker: Speaker) =>
  `${environment.siteUrl}/speakers/${speaker.$key}/${slugify(speaker.name)}`;
export const sessionUrl = (session: Session) =>
  `${environment.siteUrl}/schedule/${session.$key}/${slugify(session.title)}`;

/** The conference itself. Pages add to it (performer, subEvent); its identity stays the same. */
export function conferenceEvent(extra: object = {}) {
  return {
    '@type': 'Event',
    '@id': EVENT_ID,
    name: `DevFestMN ${environment.year}`,
    url: environment.siteUrl,
    description: environment.siteDescription,
    image: [`${environment.siteUrl}${environment.socialImage}`],
    startDate: `${environment.eventDate}T09:00:00${eventUtcOffset}`,
    endDate: `${environment.eventDate}T17:00:00${eventUtcOffset}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: venue,
    organizer,
    ...tickets,
    ...extra,
  };
}

export function personRef(speaker: Speaker) {
  return { '@type': 'Person', name: speaker.name, url: speakerUrl(speaker) };
}

/**
 * One session, or null when it has no start time yet or the schedule isn't public (search engines
 * require a start time). `schedule` is
 * every public session, which decides when this one ends. `speakers` looks up a speaker by key; only
 * published speakers are public. On its own page a session names the conference as its superEvent;
 * in the schedule it's already nested in the conference's subEvent list.
 */
export function sessionEvent(
  session: Session,
  schedule: Session[],
  speakers: (key: string) => Speaker | undefined,
  { standalone = false } = {},
) {
  if (!environment.showSchedule || !session.title || !session.startTime) return null;
  const end = sessionEnd(session, schedule);
  const performers = Object.values<string>(session.speakers ?? {})
    .map(speakers)
    .filter((speaker) => speaker?.published && speaker.name)
    .map(personRef);
  return {
    '@type': 'Event',
    '@id': `${sessionUrl(session)}#event`,
    name: session.title,
    url: sessionUrl(session),
    ...(session.description && { description: summarize(session.description, 500) }),
    image: [`${environment.siteUrl}${environment.socialImage}`],
    startDate: withOffset(session.startTime),
    ...(end && { endDate: inEventZone(end) }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    // Search engines want an address on the location itself, so a room repeats the venue's.
    location: session.room
      ? { '@type': 'Place', name: session.room, address: venue.address, containedInPlace: venue }
      : venue,
    ...(performers.length && { performer: performers }),
    organizer,
    ...tickets,
    ...(standalone && { superEvent: conferenceEvent() }),
  };
}

/** Sessions with a start time, in schedule order. */
export function scheduledSessionEvents(
  sessions: Session[],
  speakers: (key: string) => Speaker | undefined,
) {
  return [...sessions]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((session) => sessionEvent(session, sessions, speakers))
    .filter(Boolean);
}
