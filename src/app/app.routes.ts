import { Routes } from '@angular/router';
import AdminRoutes from './admin/admin.routes';
import { DataService } from './shared/data.service';
import { importProvidersFrom } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { AuthService } from './realtime-data/auth.service';
import { FirebaseService } from './realtime-data/firebase.service';
import { environment } from '../environments/environment';
import { AngularFireModule } from '@angular/fire/compat';

const dataProviders = [
    DataService,
    importProvidersFrom(AngularFireModule.initializeApp(environment.firebaseConfig)),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideDatabase(() => getDatabase()),
    provideAuth(() => getAuth()),
    AuthService,
    FirebaseService,
];

export const MainRoutes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home/home.component'),
    },
    {
        path: 'tickets',
        loadComponent: () => import('./tickets/tickets.component').then((m) => m.TicketsComponent),
        data: { title: 'Tickets' },
    },
    {
        path: 'refunds',
        loadComponent: () => import('./refunds/refunds.component').then((m) => m.RefundsComponent),
        data: { title: 'Refunds' },
    },
    {
        path: 'past',
        loadComponent: () => import('./past/past.component').then((m) => m.PastComponent),
        data: { title: 'Past DevFestMN Events' },
    },
    {
        path: 'conduct',
        loadComponent: () => import('./conduct/conduct.component').then((m) => m.ConductComponent),
        data: { title: 'Code of Conduct' },
    },
    {
        path: 'sponsors',
        loadComponent: () =>
            import('./content/sponsors.component').then((m) => m.SponsorsComponent),
        data: { title: 'Sponsors' },
    },
    {
        path: 'speaker-cfp',
        loadComponent: () =>
            import('./content/speaker-cfp.component').then((m) => m.SpeakerCfpComponent),
        data: { title: 'Speaker Call for Papers' },
    },
    {
        path: 'gallery',
        loadComponent: () => import('./gallery/gallery.component').then((m) => m.GalleryComponent),
        data: { title: 'Photo Gallery' },
    },
    {
        path: '',
        pathMatch: 'prefix',
        providers: dataProviders,
        children: [
            {
                path: 'sessions',
                loadComponent: () =>
                    import('./main/sessions.component').then((m) => m.SessionsComponent),
                data: { title: 'Sessions' },
            },
            {
                path: 'speakers',
                loadComponent: () =>
                    import('./main/speakers.component').then((m) => m.SpeakersComponent),
                data: { title: 'Speakers' },
            },
            {
                path: 'speakers/:id/:seo',
                loadComponent: () =>
                    import('./main/speakers-view.component').then((m) => m.SpeakersViewComponent),
                data: { title: false },
            },
            {
                path: 'schedule',
                loadComponent: () =>
                    import('./main/schedule.component').then((m) => m.ScheduleComponent),
                data: { title: 'Schedule' },
            },
            {
                path: 'schedule/:id/feedback',
                loadComponent: () =>
                    import('./main/session-feedback.component').then(
                        (m) => m.SessionFeedbackComponent
                    ),
                data: { title: 'Session Feedback' },
            },
            {
                path: 'schedule/:id/:seo',
                loadComponent: () =>
                    import('./main/session-view.component').then((m) => m.SessionViewComponent),
                data: { title: false },
            },
            { path: 'admin', loadChildren: () => AdminRoutes },
        ],
    },
];

export default MainRoutes;
