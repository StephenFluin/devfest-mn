import { getAuth, provideAuth } from '@angular/fire/auth';
import { Routes } from '@angular/router';
import { FirebaseService } from '../realtime-data/firebase.service';
import { AuthService } from '../realtime-data/auth.service';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../../environments/environment';
import { AngularFireModule } from '@angular/fire/compat';
import { importProvidersFrom } from '@angular/core';
import { DataService } from '../shared/data.service';

export const AdminRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        providers: [
            DataService,
            importProvidersFrom(AngularFireModule.initializeApp(environment.firebaseConfig)),
            provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
            provideDatabase(() => getDatabase()),
            provideAuth(() => getAuth()),
            AuthService,
            FirebaseService,
        ],
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
