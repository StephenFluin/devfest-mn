import { Component, computed, DOCUMENT, inject, VERSION } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { AuthService } from '../realtime-data/auth.service';
import { environment } from '../../environments/environment';

/** Sections in the admin nav, in order. */
const SECTIONS = [
    { path: '/admin', label: 'Overview', exact: true },
    { path: '/admin/rooms', label: 'Rooms' },
    { path: '/admin/reports', label: 'Feedback' },
    { path: '/admin/session-report', label: 'Session scores' },
    { path: '/admin/burndown', label: 'Tickets' },
    { path: '/admin/utm-funnel', label: 'UTM funnel' },
    { path: '/admin/volunteers', label: 'Volunteers' },
];

@Component({
    host: { class: 'admin' },
    template: `
        <header class="admin-header">
            <div>
                <p class="eyebrow">DevFestMN {{ year }}</p>
                <h1>Admin</h1>
            </div>
            @if (auth.uid()) {
            <div class="account">
                <span class="avatar" aria-hidden="true">{{ initials() }}</span>
                <span class="who">
                    <strong>{{ auth.name() }}</strong>
                    <span class="muted">{{ auth.isAdmin() ? 'Admin' : 'Signed in' }}</span>
                </span>
                <button mat-stroked-button type="button" (click)="auth.logout()">Sign out</button>
            </div>
            }
        </header>

        @if (!auth.uid()) {
        <section class="card gate">
            <h2>Sign in to continue</h2>
            <p class="muted">The admin is for DevFestMN organizers. Sign in with your Google account.</p>
            <button mat-flat-button type="button" (click)="auth.login()">Sign in with Google</button>
        </section>
        } @else { @if (auth.isAdmin()) {
        <nav class="admin-nav" aria-label="Admin sections">
            @for (section of sections; track section.path) {
            <a
                [routerLink]="section.path"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: !!section.exact }"
                >{{ section.label }}</a
            >
            }
        </nav>
        }
        <router-outlet />
        }
    `,
    styles: `
        .admin-header {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .eyebrow {
            margin: 0 0 2px;
            font: var(--mat-sys-label-large);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--mat-sys-primary);
        }
        .account {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 6px 6px 6px 6px;
            border-radius: 999px;
            background: var(--mat-sys-surface-container);
        }
        .who {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
            font: var(--mat-sys-body-medium);
        }
        .avatar {
            width: 36px;
            height: 36px;
        }
        .admin-nav {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding: 4px;
            margin-bottom: 32px;
            border-radius: 999px;
            background: var(--mat-sys-surface-container);
            scrollbar-width: none;
        }
        .admin-nav a {
            flex: none;
            padding: 10px 18px;
            border-radius: 999px;
            font: var(--mat-sys-label-large);
            color: var(--mat-sys-on-surface-variant);
            text-decoration: none;
            transition: background-color 0.15s, color 0.15s;
        }
        .admin-nav a:hover {
            background: var(--mat-sys-surface-container-highest);
            color: var(--mat-sys-on-surface);
        }
        .admin-nav a.active {
            background: var(--mat-sys-primary);
            color: var(--mat-sys-on-primary);
        }
        .gate {
            max-width: 480px;
        }
    `,
    imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButtonModule],
    providers: [
        { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    ],
})
export class AdminComponent {
    auth = inject(AuthService);
    readonly year = environment.year;
    readonly sections = SECTIONS;

    initials = computed(() =>
        (this.auth.name() ?? '?')
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
    );

    constructor() {
        // Only admin pages use Material components, so their theme (src/admin.scss, built
        // separately in angular.json) is loaded here instead of blocking every public page.
        const doc = inject(DOCUMENT);
        if (!doc.getElementById('material-theme')) {
            const link = doc.createElement('link');
            link.id = 'material-theme';
            link.rel = 'stylesheet';
            // The file name isn't hashed; the version busts the long-lived static cache.
            link.href = `/material-theme.css?v=${VERSION.full}`;
            doc.head.appendChild(link);
        }
    }
}
