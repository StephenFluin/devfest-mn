import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { environment } from '../../environments/environment';
import { trackTicketPurchase } from '../analytics.util';

@Component({
    selector: 'app-ticket-embed',
    imports: [],
    template: ` <div id="eventbrite-widget-container-1684295616529"></div>
        @if(!isSecure) {
        <p>Ticket window not loaded over http.</p>
        }`,
    styles: ``,
})
export class TicketEmbedComponent {
    environment = environment;
    private platformId = inject(PLATFORM_ID);
    private isBrowser = isPlatformBrowser(this.platformId);
    isSecure = this.isBrowser && window?.location?.protocol === 'https:';
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
