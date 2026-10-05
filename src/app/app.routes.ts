import { Routes } from '@angular/router';
import AdminRoutes from './admin/admin.routes';

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
        data: {
            title: 'Past DevFestMN Events',
            description: 'DevFestMN has brought the Twin Cities developer community together since 2013.',
        },
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
        data: {
            title: 'Sponsors',
            description:
                'Sponsor DevFestMN 2026 and put your company in front of hundreds of Twin Cities developers, designers, and tech leaders.',
        },
    },
    {
        path: 'speaker-cfp',
        loadComponent: () =>
            import('./content/speaker-cfp.component').then((m) => m.SpeakerCfpComponent),
        data: {
            title: 'Speaker Call for Papers',
            description:
                'Submit a talk for DevFestMN 2026. We want sessions on AI and agents, Google technologies, web, mobile, cloud, security, and careers from speakers of every experience level.',
        },
    },
    {
        path: 'gallery',
        loadComponent: () => import('./gallery/gallery.component').then((m) => m.GalleryComponent),
        data: {
            title: 'Photo Gallery',
            description: 'Photos from past DevFestMN developer conferences in the Twin Cities.',
        },
    },
    {
        path: '',
        pathMatch: 'prefix',
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
                data: {
                    title: 'Speakers',
                    description: 'Meet the speakers at DevFestMN 2026.',
                },
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
                data: {
                    title: 'Schedule',
                    description: 'The full session schedule for DevFestMN 2026.',
                },
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
