import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ref } from 'firebase/database';
import { RouterLink } from '@angular/router';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
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
        <a class="tile link" routerLink="/admin/sessions">
          <span class="label">Sessions</span>
          <span class="value">{{ ds.schedule().length }}</span>
          <span class="note">{{ unpublishedSessions() }} unpublished</span>
        </a>
        <div class="tile">
          <span class="label">Published speakers</span>
          <span class="value">{{ published() }}</span>
          <span class="note">of {{ ds.speakers().length }} total</span>
        </div>
        <div class="tile">
          <span class="label">Rooms</span>
          <span class="value">{{ ds.rooms().length }}</span>
        </div>
      </div>

      <section class="card announce" aria-labelledby="schedule-heading">
        <div>
          <h3 id="schedule-heading">Schedule</h3>
          @if (ds.showSchedule()) {
            <p>
              <strong>Announced.</strong> The site links to the schedule, and session pages,
              calendar files and search engines get each session's time and room.
            </p>
          } @else {
            <p>
              <strong>Not announced yet.</strong> The site has no Schedule link, and session pages
              leave out times and rooms. Anyone who knows the address can still open
              <a routerLink="/schedule">/schedule</a>, which shows every published session that has
              a time.
            </p>
          }
          <p class="muted">
            @if (unplaced(); as count) {
              {{ count }} of {{ ds.publishedSchedule().length }} published sessions
              {{ count === 1 ? 'has' : 'have' }} no time or room yet, so
              {{ count === 1 ? "it isn't" : "they aren't" }} on the schedule.
              <a routerLink="/admin/sessions">Session planning</a> lists what each needs.
            } @else {
              All {{ ds.publishedSchedule().length }} published sessions have a time and room.
            }
          </p>
          @if (scheduleError(); as error) {
            <p class="error" role="alert">{{ error }}</p>
          }
        </div>
        <mat-slide-toggle [checked]="ds.showSchedule()" (change)="setShowSchedule($event)">
          Show the schedule
        </mat-slide-toggle>
      </section>

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
    .announce {
      display: flex;
      flex-wrap: wrap;
      gap: 16px 32px;
      align-items: center;
      justify-content: space-between;
    }
    .announce > div {
      flex: 1 1 420px;
    }
    .announce p:last-child {
      margin-bottom: 0;
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
  imports: [RouterLink, DecimalPipe, MatSlideToggleModule],
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

  published = () => this.ds.speakers().filter((speaker) => speaker.published).length;

  unpublishedSessions = computed(
    () => this.ds.schedule().filter((session) => !session.published).length,
  );

  /** Published sessions the schedule can't place yet: no start time, or no room unless it's for everyone. */
  unplaced = computed(
    () =>
      this.ds
        .publishedSchedule()
        .filter((session) => !session.startTime || (!session.room && session.track !== 'all'))
        .length,
  );

  scheduleError = signal('');

  /** Announces the schedule, or takes that back, for everyone right away. */
  async setShowSchedule(change: MatSlideToggleChange) {
    this.scheduleError.set('');
    try {
      await this.ds.setShowSchedule(change.checked);
    } catch (error) {
      console.error('Error saving the schedule setting', error);
      // Back to what's saved, since the switch has already moved.
      change.source.checked = this.ds.showSchedule();
      this.scheduleError.set(
        `Couldn't save: ${error.message ?? error}. If this switch is new, deploy the database rules (see the README).`,
      );
    }
  }

  readonly links = [
    {
      path: '/admin/burndown',
      title: 'Ticket sales',
      description: 'Burndown compared with past years.',
    },
    {
      path: '/admin/campaigns',
      title: 'Campaigns',
      description: 'Short links, QR codes and promo codes for each place the event is promoted.',
    },
    {
      path: '/admin/sponsors',
      title: 'Sponsors',
      description: 'Sponsor levels, logos, links, and home page visibility.',
    },
    {
      path: '/admin/utm-funnel',
      title: 'UTM funnel',
      description: 'Where visitors come from and what they do.',
    },
    {
      path: '/admin/sessions',
      title: 'Session planning',
      description: 'Sessions in progress, their speakers, and what each still needs.',
    },
    {
      path: '/admin/edit-log',
      title: 'Edit log',
      description: 'Who changed which speaker or session, and when.',
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
