import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import snarkdown from 'snarkdown';

import { environment } from '../../environments/environment';
import { ADirective } from '../a.directive';
import { OurMeta } from '../our-meta.service';
import { AuthService } from '../realtime-data/auth.service';
import { DataService, Session, Speaker } from '../shared/data.service';
import { slugify, summarize } from '../shared/slug';

/** An absolute URL for an image that may be stored as a site-relative path. */
const absolute = (url: string) => (url.startsWith('/') ? `${environment.siteUrl}${url}` : url);

@Component({
    selector: 'speaker-full',
    templateUrl: 'speaker-full.component.html',
    imports: [RouterLink, ADirective],
})
export class SpeakerFullComponent {
    auth = inject(AuthService);
    private ds = inject(DataService);
    environment = environment;
    slugify = slugify;

    readonly speaker = input<Speaker>(undefined);
    readonly year = input(undefined);

    renderedBio = computed(() => snarkdown(this.speaker()?.bio || ''));
    sessions = computed(() => this.ds.sessionsFor(this.speaker()?.$key));
    links = computed(() => {
        const speaker = this.speaker();
        return [
            speaker?.twitter && { label: `@${speaker.twitter}`, url: `https://x.com/${speaker.twitter}` },
            speaker?.linkedin && { label: 'LinkedIn', url: speaker.linkedin },
            speaker?.website && { label: 'Website', url: speaker.website },
        ].filter(Boolean) as { label: string; url: string }[];
    });

    constructor() {
        const meta = inject(OurMeta);
        effect(() => {
            const speaker = this.speaker();
            if (!speaker?.name) return;
            const path = `speakers/${speaker.$key}/${slugify(speaker.name)}`;
            const sessions = this.sessions();
            meta.setPageTitle(`${speaker.name} – Speaking at DevFestMN ${environment.year}`);
            meta.setCanonical(path);
            meta.setDescription(describe(speaker, sessions));
            meta.setType('profile');
            const alt = `${speaker.name}, speaker at DevFestMN ${environment.year}`;
            if (speaker.confirmed) {
                // Rendered by the server (src/speaker-card.ts). The version changes whenever the
                // speaker or one of their sessions is saved, so shares pick up the new card.
                const version = Math.max(
                    speaker.updatedAt ?? 0,
                    ...sessions.map((session) => session.updatedAt ?? 0)
                );
                meta.setImage(
                    `${environment.siteUrl}/og/speakers/${speaker.$key}.png?v=${version}`,
                    alt,
                    { width: 1200, height: 630 }
                );
            } else if (speaker.imageUrl) {
                meta.setImage(absolute(speaker.imageUrl), alt);
            }
            meta.setStructuredData(personData(speaker, path, this.links().map((link) => link.url)));
        });
    }
}

/** Leads with the talk, since that's what people search for, then the bio. */
function describe(speaker: Speaker, sessions: Session[]) {
    const titles = sessions.map((session) => session.title).filter(Boolean);
    const who = speaker.company ? `${speaker.name} from ${speaker.company}` : speaker.name;
    const talk = titles.length ? ` on “${titles.join('” and “')}”` : '';
    const intro = `${who} speaks${talk} at DevFestMN ${environment.year}, ${environment.eventDateDisplay} in Minneapolis.`;
    // Add the bio only when it fits; a bio cut to a few words reads worse than none.
    const full = speaker.bio ? `${intro} ${summarize(speaker.bio, 1000)}` : intro;
    return full.length <= 160 ? full : summarize(intro);
}

function personData(speaker: Speaker, path: string, sameAs: string[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: speaker.name,
        url: `${environment.siteUrl}/${path}`,
        ...(speaker.imageUrl && { image: absolute(speaker.imageUrl) }),
        ...(speaker.bio && { description: summarize(speaker.bio) }),
        ...(speaker.company && { worksFor: { '@type': 'Organization', name: speaker.company } }),
        ...(sameAs.length && { sameAs }),
        performerIn: {
            '@type': 'Event',
            name: `DevFestMN ${environment.year}`,
            startDate: `${environment.eventDate}T09:00-06:00`,
            url: environment.siteUrl,
            location: {
                '@type': 'Place',
                name: environment.venueName,
                address: environment.venueAddress,
            },
        },
    };
}
