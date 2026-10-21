import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ref } from 'firebase/database';
import { RouterLink } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';
import { DataService } from '../shared/data.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-admin-home',
  template: `
    @if (auth.isAdmin()) {
      <div class="page-header">
        <div>
          <h2>Overview</h2>
          <p class="muted">
            Sessions and speakers are edited from the public pages, with edit buttons only admins
            see.
          </p>
        </div>
      </div>

      <div class="tiles">
        <a class="tile link" routerLink="/admin/burndown">
          <span class="label">Tickets sold</span>
          <span class="value">{{ ticketsSold() | number }}</span>
          <span class="note">{{ daysLeft() }} days to go</span>
        </a>
        <div class="tile">
          <span class="label">Sessions</span>
          <span class="value">{{ ds.schedule().length }}</span>
        </div>
        <div class="tile">
          <span class="label">Confirmed speakers</span>
          <span class="value">{{ confirmed() }}</span>
          <span class="note">of {{ ds.speakers().length }} total</span>
        </div>
        <div class="tile">
          <span class="label">Rooms</span>
          <span class="value">{{ ds.rooms().length }}</span>
        </div>
      </div>

      <div class="links">
        @for (link of links; track link.path) {
          <a class="link-card" [routerLink]="link.path">
            <strong>{{ link.title }}</strong>
            <span class="muted">{{ link.description }}</span>
          </a>
        }
      </div>
    } @else {
      <section class="card">
        <h2>You're not an admin yet</h2>
        <p class="muted">
          Ask an organizer to add <strong>{{ auth.email() }}</strong> on the Admins page, then
          reload this page.
        </p>
      </section>
    }
  `,
  styles: `
    .tile.link {
      color: inherit !important;
      text-decoration: none !important;
      border: 1px solid transparent;
    }
    .tile.link:hover {
      border-color: var(--mat-sys-primary);
    }
    .links {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .link-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px;
      border-radius: var(--admin-radius);
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface) !important;
      text-decoration: none !important;
      transition:
        border-color 0.15s,
        transform 0.15s,
        box-shadow 0.15s;
    }
    .link-card strong {
      font: var(--mat-sys-title-medium);
    }
    .link-card:hover {
      border-color: var(--mat-sys-primary);
      box-shadow: var(--admin-shadow);
    }
    @media (prefers-reduced-motion: no-preference) {
      .link-card:hover {
        transform: translateY(-2px);
      }
    }
  `,
  imports: [RouterLink, DecimalPipe],
})
export class AdminHomeComponent {
  auth = inject(AuthService);
  ds = inject(DataService);

  private db = inject(DATABASE);

  /** This year's orders, as copied from Eventbrite for the burndown. */
  private orders = objectResource<Record<string, { tickets: number }> | null>(
    () => (this.auth.isAdmin() ? ref(this.db, `burndown/${environment.year}/orders`) : undefined),
    { initialValue: null },
  );
  ticketsSold = computed(() =>
    Object.values(this.orders() ?? {}).reduce((sum, order) => sum + (order.tickets ?? 0), 0),
  );
  daysLeft = computed(() =>
    Math.max(
      0,
      Math.ceil((Date.parse(`${environment.eventDate}T00:00:00-06:00`) - Date.now()) / 86_400_000),
    ),
  );

  confirmed = () => this.ds.speakers().filter((speaker) => speaker.confirmed).length;

  readonly links = [
    {
      path: '/admin/burndown',
      title: 'Ticket sales',
      description: 'Burndown compared with past years.',
    },
    {
      path: '/admin/utm-funnel',
      title: 'UTM funnel',
      description: 'Where visitors come from and what they do.',
    },
    { path: '/admin/rooms', title: 'Rooms', description: 'Names, directions and schedule order.' },
    {
      path: '/admin/volunteers',
      title: 'Volunteers',
      description: 'Add or remove volunteers by email.',
    },
    { path: '/admin/admins', title: 'Admins', description: 'Add or remove admins by email.' },
    { path: '/schedule', title: 'Schedule', description: 'Edit sessions and add new ones.' },
    { path: '/speakers', title: 'Speakers', description: 'Edit speaker profiles and photos.' },
  ];
}
