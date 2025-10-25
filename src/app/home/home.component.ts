import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { YearService } from '../year.service';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

import { trackTicketPurchase } from '../analytics.util';

declare global {
    interface Window {
        EBWidgets: any;
        gtag: any;
    }
}

@Component({
    templateUrl: './home.component.html',
    imports: [RouterLink, ADirective],
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

    constructor() {
        const yearService = inject(YearService);
        yearService.reset();
    }

    ngAfterViewInit() {
        if (!this.isBrowser || !this.isSecure) {
            return;
        }

        // Dynamically import eb-widget only in browser
        import('../../eb-widget').then(() => {
            window.EBWidgets.createWidget({
                widgetType: 'checkout',
                eventId: environment.eventbriteEventId,
                iframeContainerId: 'eventbrite-widget-container-1684295616529',

                // Optional
                iframeContainerHeight: 600, // Widget height in pixels. Defaults to a minimum of 425px if not provided
                onOrderComplete: trackTicketPurchase, // Method called when an order has successfully completed
            });
            console.log('Created widget');
        });
    }
}

export default HomeComponent;
