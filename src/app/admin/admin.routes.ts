import { inject } from '@angular/core';
import { CanMatchFn, Routes } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';

/**
 * The database rules are what actually protect admin data; this keeps non-admins from loading
 * the admin pages at all. Returning false (not a redirect) lets /admin fall through to the home
 * page, which shows the login button.
 */
const isAdmin: CanMatchFn = () => inject(AuthService).checkAdmin();

export const AdminRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        children: [
            {
                path: '',
                loadComponent: () => import('./admin.component').then((m) => m.AdminComponent),
                children: [
                    {
                        path: '',
                        canMatch: [isAdmin],
                        children: [
                            {
                                path: 'speakers/:id/edit',
                                loadComponent: () =>
                                    import('./speaker-edit.component').then(
                                        (m) => m.SpeakerEditComponent
                                    ),
                            },
                            {
                                path: 'sessions/:id/edit',
                                loadComponent: () =>
                                    import('./session-edit.component').then(
                                        (m) => m.SessionEditComponent
                                    ),
                            },
                            {
                                path: 'sessions/:id/edit/:time/:room',
                                loadComponent: () =>
                                    import('./session-edit.component').then(
                                        (m) => m.SessionEditComponent
                                    ),
                            },
                            {
                                path: 'session-report',
                                loadComponent: () =>
                                    import('./session-report.component').then(
                                        (m) => m.SessionReportComponent
                                    ),
                            },
                            {
                                path: 'reports',
                                loadComponent: () =>
                                    import('./reports.component').then((m) => m.ReportsComponent),
                            },
                            {
                                path: 'burndown',
                                loadComponent: () =>
                                    import('./burndown.component').then((m) => m.BurndownComponent),
                            },
                            {
                                path: 'utm-funnel',
                                loadComponent: () =>
                                    import('./utm-funnel.component').then(
                                        (m) => m.UtmFunnelComponent
                                    ),
                            },
                            {
                                path: 'volunteers',
                                loadComponent: () =>
                                    import('./volunteers.component').then(
                                        (m) => m.VolunteersComponent
                                    ),
                            },
                            {
                                path: 'events',
                                loadComponent: () =>
                                    import('./events.component').then((m) => m.EventsComponent),
                            },
                        ],
                    },
                    {
                        path: '',
                        loadComponent: () =>
                            import('./admin-home.component').then((m) => m.AdminHomeComponent),
                    },
                    { path: '**', redirectTo: './' },
                ],
            },
        ],
    },
];

export default AdminRoutes;
