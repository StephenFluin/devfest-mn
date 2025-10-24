import { Component } from '@angular/core';
import { trackTicketPurchase } from '../analytics.util';
import { environment } from '../../environments/environment';

import '../../eb-widget';

@Component({
    selector: 'app-tickets',
    imports: [],
    template: `
        <section>
            <h2>Buy Tickets</h2>
            <div id="eventbrite-widget-container-1684295616529"></div>
        </section>
    `,
    styles: ``,
})
export class TicketsComponent {
    constructor() {
        window['EBWidgets'].createWidget({
            widgetType: 'checkout',
            eventId: environment.eventbriteEventId,
            modal: true,
            modalTriggerElementId: 'global-ticket-button',
            onOrderComplete: trackTicketPurchase,
        });
    }
}
