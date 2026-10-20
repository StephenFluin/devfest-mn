import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';
import { DataService } from '../shared/data.service';

@Component({
    selector: 'app-admin-home',
    template: `
        @if (auth.isAdmin()) {
        <div class="page-header">
            <div>
                <h2>Overview</h2>
                <p class="muted">Sessions and speakers are edited from the public pages, with edit buttons only admins see.</p>
            </div>
        </div>

        <div class="tiles">
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
            <p class="muted">Ask an organizer to add your account. They'll need your user ID:</p>
            <p><code>{{ auth.uid() }}</code></p>
        </section>
        }
    `,
    styles: `
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
            transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
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
    imports: [RouterLink],
})
export class AdminHomeComponent {
    auth = inject(AuthService);
    ds = inject(DataService);

    confirmed = () => this.ds.speakers().filter((speaker) => speaker.confirmed).length;

    readonly links = [
        { path: '/schedule', title: 'Schedule', description: 'Edit sessions and add new ones.' },
        { path: '/admin/sessions/new/edit', title: 'New session', description: 'Start a session from scratch.' },
        { path: '/speakers', title: 'Speakers', description: 'Edit speaker profiles and photos.' },
        { path: '/admin/speakers/new/edit', title: 'New speaker', description: 'Add someone to the lineup.' },
        { path: '/admin/rooms', title: 'Rooms', description: 'Names, directions and schedule order.' },
        { path: '/admin/burndown', title: 'Ticket sales', description: 'Burndown compared with past years.' },
    ];
}
