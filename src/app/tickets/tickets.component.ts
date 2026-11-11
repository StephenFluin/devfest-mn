import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';

@Component({
  selector: 'app-tickets',
  imports: [RouterLink, TicketEmbedComponent],
  host: { ngSkipHydration: 'true' },
  template: `
    <section>
      <h2>Buy Tickets</h2>
      <p class="ticket-summary">
        <strong>DevFestMN {{ environment.year }}</strong> · {{ environment.eventDateDisplay }} ·
        {{ environment.venueName }}, Minneapolis
      </p>
      <ul class="ticket-includes">
        <li>Every talk and hands-on workshop, across two tracks</li>
        <li>Catered lunch</li>
        <li>A day with the Twin Cities developer community</li>
      </ul>
      <app-ticket-embed></app-ticket-embed>
      <p class="ticket-links">
        <a routerLink="/speakers">See the speakers and talks</a> ·
        <a routerLink="/refunds">Refund policy</a> ·
        <a routerLink="/conduct">Code of conduct</a>
        @if (environment.showVolunteer) {
          · <a [href]="environment.showVolunteer">Volunteer for a free ticket</a>
        }
      </p>
    </section>
  `,
  styles: `
    .ticket-summary {
      margin-bottom: 8px;
    }
    .ticket-includes {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px 24px;
      margin: 0 0 24px;
      padding: 0;
      list-style: none;
      color: var(--color-text-muted);
    }
    .ticket-includes li::before {
      content: '✓ ';
      color: var(--color-heading);
      font-weight: bold;
    }
    .ticket-links {
      font-size: 14px;
    }
  `,
})
export class TicketsComponent {
  environment = environment;
}
