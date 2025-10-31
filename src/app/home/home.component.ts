import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

import { trackTicketPurchase } from '../analytics.util';
import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';

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
    mode: 'dayof' | 'early' = 'early';
    faqSelection = 1;
    private platformId = inject(PLATFORM_ID);
    private isBrowser = isPlatformBrowser(this.platformId);
    isSecure = this.isBrowser && window?.location?.protocol === 'https:';

    setFaqSelection(question) {
        this.faqSelection = question;
    }
}

export default HomeComponent;
