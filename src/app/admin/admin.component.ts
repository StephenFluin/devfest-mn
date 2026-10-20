import { Component, computed, DOCUMENT, inject, VERSION } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { AuthService } from '../realtime-data/auth.service';
import { environment } from '../../environments/environment';

/** The admin nav, in order of what matters most as the event approaches. */
const NAV = [
    {
        label: 'Manage',
        links: [
            { path: '/admin/overview', label: 'Overview' },
            { path: '/admin/burndown', label: 'Ticket sales' },
            { path: '/admin/utm-funnel', label: 'UTM funnel' },
            { path: '/admin/rooms', label: 'Rooms' },
            { path: '/admin/volunteers', label: 'Volunteers' },
            { path: '/admin/reports', label: 'Feedback' },
            { path: '/admin/session-report', label: 'Session scores' },
        ],
    },
    {
        label: 'Public site',
        links: [
            { path: '/schedule', label: 'Schedule' },
            { path: '/speakers', label: 'Speakers' },
        ],
    },
];

@Component({
    host: { class: 'admin' },
    template: `
        @if (!auth.uid()) {
        <div class="gate">
            <section class="card" aria-labelledby="gate-heading">
                <img src="/a/images/devfestmn-icon.svg" width="40" height="40" alt="" />
                <p class="eyebrow">DevFestMN {{ year }}</p>
                <h1 id="gate-heading">Sign in to the admin</h1>
                <p class="muted">For DevFestMN organizers and volunteers. Use your Google account.</p>
                <button mat-flat-button type="button" (click)="signIn()">Sign in with Google</button>
            </section>
        </div>
        } @else {
        <div class="layout" [class.no-nav]="!auth.isAdmin()">
            @if (auth.isAdmin()) {
            <nav class="sidebar" aria-label="Admin">
                <a class="brand" routerLink="/admin">
                    <span class="eyebrow">DevFestMN {{ year }}</span>
                    <strong>Admin</strong>
                </a>
                @for (group of nav; track group.label) {
                <div class="group">
                    <span class="group-label" [id]="'nav-' + $index">{{ group.label }}</span>
                    <ul [attr.aria-labelledby]="'nav-' + $index">
                        @for (link of group.links; track link.path) {
                        <li>
                            <a
                                [routerLink]="link.path"
                                routerLinkActive="active"
                                ariaCurrentWhenActive="page"
                                >{{ link.label }}</a
                            >
                        </li>
                        }
                    </ul>
                </div>
                }
            </nav>
            }
            <div class="content">
                <div class="topbar">
                    <span class="avatar" aria-hidden="true">{{ initials() }}</span>
                    <span class="who">
                        <strong>{{ auth.name() }}</strong>
                        <span class="muted">{{ auth.isAdmin() ? 'Admin' : 'Signed in' }}</span>
                    </span>
                    <button mat-button type="button" (click)="auth.logout()">Sign out</button>
                </div>
                <router-outlet />
            </div>
        </div>
        }
    `,
    styles: `
        .eyebrow {
            font: var(--mat-sys-label-medium);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--mat-sys-primary);
        }

        /* Signed out: one centered card. */
        .gate {
            display: grid;
            place-items: center;
            min-height: 60vh;
        }
        .gate .card {
            width: min(100%, 420px);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            text-align: center;
            padding: 40px 32px;
        }
        .gate h1 {
            font: var(--mat-sys-headline-small);
            font-weight: 700;
            margin: 0 0 4px;
        }
        .gate button {
            margin-top: 16px;
        }

        /* Signed in: sidebar and content. */
        .layout {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 40px;
            align-items: start;
        }
        .layout.no-nav {
            grid-template-columns: minmax(0, 1fr);
        }
        .sidebar {
            position: sticky;
            top: 96px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        .brand {
            display: flex;
            flex-direction: column;
            text-decoration: none !important;
            color: var(--mat-sys-on-surface) !important;
            padding: 0 12px;
        }
        .brand strong {
            font: var(--mat-sys-title-large);
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
        }
        .group-label {
            display: block;
            padding: 0 12px 6px;
            font: var(--mat-sys-label-medium);
            color: var(--mat-sys-on-surface-variant);
        }
        .group ul {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .group a {
            display: block;
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid transparent;
            font: var(--mat-sys-label-large);
            color: var(--mat-sys-on-surface-variant) !important;
            text-decoration: none !important;
        }
        .group a:hover {
            background: var(--mat-sys-surface-container-high);
            color: var(--mat-sys-on-surface) !important;
        }
        .group a.active {
            border-left-color: var(--mat-sys-primary);
            background: var(--mat-sys-secondary-container);
            color: var(--mat-sys-on-secondary-container) !important;
            font-weight: 700;
        }
        .topbar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            padding-bottom: 16px;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--mat-sys-outline-variant);
        }
        .who {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
            font: var(--mat-sys-body-medium);
        }

        /* Narrow screens: the nav becomes a scrolling row of tabs above the content. */
        @media (max-width: 840px) {
            .layout {
                grid-template-columns: minmax(0, 1fr);
                gap: 16px;
            }
            .sidebar {
                position: static;
                flex-direction: row;
                gap: 0;
                overflow-x: auto;
                border-bottom: 1px solid var(--mat-sys-outline-variant);
            }
            .brand,
            .group-label {
                display: none;
            }
            .group ul {
                flex-direction: row;
            }
            .group a {
                white-space: nowrap;
                border-left: 0;
                border-bottom: 3px solid transparent;
                border-radius: 0;
                padding: 12px 14px;
            }
            .group a.active {
                background: none;
                color: var(--mat-sys-primary) !important;
                border-bottom-color: var(--mat-sys-primary);
            }
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
    readonly nav = NAV;
    private router = inject(Router);

    /** Signs in, then opens the admin's default page (signed out, every page shows sign-in). */
    async signIn() {
        try {
            await this.auth.login();
            this.router.navigateByUrl('/admin');
        } catch {
            // Closed the popup or sign-in failed; stay on the sign-in card.
        }
    }

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
