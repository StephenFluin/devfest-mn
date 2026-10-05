import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';

import { environment } from '../../environments/environment';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';
import { LdJsonService } from '../ld-json.service';
import { cfpCountdown } from '../shared/cfp-deadline';

declare global {
    interface Window {
        EBWidgets: any;
        gtag: any;
    }
}

@Component({
    templateUrl: './home.component.html',
    imports: [RouterLink, ADirective, TicketEmbedComponent, DatePipe],
    styles: `
        .hero-title {
            margin: 0;
            font-size: inherit;
            line-height: 0;
        }
        .hero-subtitle {
            display: block;
            margin: 4px 0 16px;
            font-size: 22px;
            line-height: 1.3;
            font-weight: 600;
            letter-spacing: 0.5px;
            color: #222;
        }
        .hero-cta {
            margin-top: 16px;
        }
        .hero-deadline {
            margin-top: 8px;
            font-size: 16px;
            color: #222;
        }
    `,
})
export class HomeComponent {
    environment = environment;
    faqSelection = 1;
    ldJsonService = inject(LdJsonService);
    cfpCountdown = cfpCountdown();

    ngOnInit() {
        this.ldJsonService.setLdJson({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: 'DevFestMN 2026',
            startDate: `${environment.eventDate}T09:00-06:00`,
            endDate: `${environment.eventDate}T17:00-06:00`,
            eventStatus: 'https://schema.org/EventScheduled',
            location: {
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
            },
            image: [`${environment.siteUrl}${environment.socialImage}`],
            description: environment.siteDescription,
            organizer: {
                '@type': 'Organization',
                name: 'GDG Twin Cities',
                url: 'https://gdg.community.dev/gdg-twin-cities/',
            },
        });
    }

    setFaqSelection(question) {
        this.faqSelection = question;
    }
}

export default HomeComponent;
