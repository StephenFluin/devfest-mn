import { Component, DOCUMENT, inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';
import { LdJsonService } from '../ld-json.service';

declare global {
    interface Window {
        EBWidgets: any;
        gtag: any;
    }
}

@Component({
    templateUrl: './home.component.html',
    imports: [RouterLink, ADirective, TicketEmbedComponent],
    host: { ngSkipHydration: 'true' },
})
export class HomeComponent {
    environment = environment;
    faqSelection = 1;
    ldJsonService = inject(LdJsonService);
    private platformId = inject(PLATFORM_ID);
    private isBrowser = isPlatformBrowser(this.platformId);
    isSecure = this.isBrowser && window?.location?.protocol === 'https:';

    ngOnInit() {
        this.ldJsonService.setLdJson({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: 'DevFestMN 2025',
            startDate: '2025-12-06T09:00-05:00',
            endDate: '2025-12-06T17:00-05:00',
            eventStatus: 'https://schema.org/EventScheduled',
            location: {
                '@type': 'Place',
                name: 'University of Minnesota Health Sciences Education Center',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: '526 Delaware St SE',
                    addressLocality: 'Minneapolis',
                    postalCode: '55455',
                    addressRegion: 'MN',
                    addressCountry: 'US',
                },
            },
            image: ['https://devfest.mn/a/images/devfestmn.svg'],
            description:
                'DevFestMN is a premier event for developers, featuring talks, workshops, and networking opportunities.',
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
