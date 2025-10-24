import { Component, inject, PLATFORM_ID } from '@angular/core';
import { trackTicketPurchase } from '../analytics.util';
import { environment } from '../../environments/environment';

import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-tickets',
    imports: [],
    host: { ngSkipHydration: 'true' },
    template: `
        <section>
            <h2>Buy Tickets</h2>
            <div id="eventbrite-widget-container-1684295616529"></div>
            @if (!isSecure) {
            <p>Ticket window isn't loaded over http.</p>
            }
        </section>
    `,
})
export class TicketsComponent {
    platformId = inject(PLATFORM_ID);
    isBrowser = isPlatformBrowser(this.platformId);
    isSecure = this.isBrowser && window?.location?.protocol === 'https:';
    constructor() {
        if (this.isSecure && this.isBrowser) {
            import('../../eb-widget').then(() => {
                window?.['EBWidgets']?.createWidget({
                    widgetType: 'checkout',
                    eventId: environment.eventbriteEventId,
                    modal: true,
                    modalTriggerElementId: 'global-ticket-button',
                    onOrderComplete: trackTicketPurchase,
                });
            });
        }
    }
}
