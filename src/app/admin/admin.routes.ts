import { getAuth, provideAuth } from '@angular/fire/auth';
import { Routes } from '@angular/router';

export const AdminRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        providers: [],
        children: [
            {
                path: '',
                loadComponent: () => import('./admin.component').then((m) => m.AdminComponent),
                children: [
                    {
                        path: 'speakers/:id/edit',
                        loadComponent: () =>
                            import('./speaker-edit.component').then((m) => m.SpeakerEditComponent),
                    },
                    {
                        path: 'sessions/:id/edit',
                        loadComponent: () =>
                            import('./session-edit.component').then((m) => m.SessionEditComponent),
                    },
                    {
                        path: 'sessions/:id/edit/:time/:room',
                        loadComponent: () =>
                            import('./session-edit.component').then((m) => m.SessionEditComponent),
                    },
                    {
                        path: 'session-report',
                        loadComponent: () =>
                            import('./session-report.component').then(
                                (m) => m.SessionReportComponent
                            ),
                    },
                    {
                        path: '',
                        loadComponent: () =>
                            import('./admin-home.component').then((m) => m.AdminHomeComponent),
                    },
                    {
                        path: 'reports',
                        loadComponent: () =>
                            import('./reports.component').then((m) => m.ReportsComponent),
                    },
                    {
                        path: 'volunteers',
                        loadComponent: () =>
                            import('./volunteers.component').then((m) => m.VolunteersComponent),
                    },
                    {
                        path: 'cfps',
                        loadComponent: () =>
                            import('./manage-cfps.component').then((m) => m.ManageCFPsComponent),
                    },
                    {
                        path: 'events',
                        loadComponent: () =>
                            import('./events.component').then((m) => m.EventsComponent),
                    },
                    { path: '**', redirectTo: './' },
                ],
            },
        ],
    },
];

export default AdminRoutes;
