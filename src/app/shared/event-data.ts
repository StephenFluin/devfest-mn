import { environment } from '../../environments/environment';
import { Session, Speaker } from './data.service';
import { slugify, summarize } from './slug';

/**
 * schema.org structured data for the conference and its talks. Every page describes the conference
 * the same way and with the same @id, so search engines treat the home page, schedule, sessions,
 * and speakers as one event: the home page lists its speakers, the schedule its talks (subEvent),
 * and each session and speaker page points back to it.
 */
export const EVENT_ID = `${environment.siteUrl}/#event`;

/** Minneapolis's UTC offset on the event date, e.g. "-06:00". */
export const eventUtcOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    timeZoneName: 'longOffset',
})
    .formatToParts(new Date(`${environment.eventDate}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')
    .value.replace('GMT', '');

/** A session start time with its time zone; older sessions were saved without one. */
const withOffset = (time: string) =>
    /(Z|[+-]\d\d:\d\d)$/.test(time) ? time : `${time.length === 16 ? `${time}:00` : time}${eventUtcOffset}`;

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

/** A conference ticket is what gets you into any talk, so talks offer the same ticket. */
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
 * One talk, or null when it has no start time yet (search engines require one). `speakers` looks up
 * a speaker by key; only confirmed speakers are public. On its own page a talk names the conference
 * as its superEvent; in the schedule it's already nested in the conference's subEvent list.
 */
export function sessionEvent(
    session: Session,
    speakers: (key: string) => Speaker | undefined,
    { standalone = false } = {}
) {
    if (!session.title || !session.startTime) return null;
    const performers = Object.values<string>(session.speakers ?? {})
        .map(speakers)
        .filter((speaker) => speaker?.confirmed && speaker.name)
        .map(personRef);
    return {
        '@type': 'Event',
        '@id': `${sessionUrl(session)}#event`,
        name: session.title,
        url: sessionUrl(session),
        ...(session.description && { description: summarize(session.description, 500) }),
        image: [`${environment.siteUrl}${environment.socialImage}`],
        startDate: withOffset(session.startTime),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: session.room
            ? { '@type': 'Place', name: session.room, containedInPlace: venue }
            : venue,
        ...(performers.length && { performer: performers }),
        organizer,
        ...tickets,
        ...(standalone && { superEvent: conferenceEvent() }),
    };
}

/** Talks with a start time, in schedule order. */
export function scheduledSessionEvents(
    sessions: Session[],
    speakers: (key: string) => Speaker | undefined
) {
    return [...sessions]
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((session) => sessionEvent(session, speakers))
        .filter(Boolean);
}
