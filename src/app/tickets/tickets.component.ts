import { Component } from '@angular/core';
import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';

@Component({
  selector: 'app-tickets',
  imports: [TicketEmbedComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <section>
      <h2>Buy Tickets</h2>
      <app-ticket-embed></app-ticket-embed>
    </section>
  `,
})
export class TicketsComponent {}
