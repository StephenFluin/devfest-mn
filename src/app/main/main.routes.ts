import { Routes } from '@angular/router';
import AdminRoutes from '../admin/admin.routes';
import { DataService } from '../shared/data.service';

export const MainRoutes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../home/home.component'),
    },
    {
        path: 'sponsors',
        loadComponent: () =>
            import('../content/sponsors.component').then((m) => m.SponsorsComponent),
        data: { title: 'Sponsors' },
    },
    {
        path: 'speaker-cfp',
        loadComponent: () =>
            import('../content/speaker-cfp.component').then((m) => m.SpeakerCfpComponent),
        data: { title: 'Speaker Call for Papers' },
    },
    {
        path: 'sessions',
        loadComponent: () => import('./sessions.component').then((m) => m.SessionsComponent),
        data: { title: 'Sessions' },
        providers: [DataService],
    },
    {
        path: 'speakers',
        loadComponent: () => import('./speakers.component').then((m) => m.SpeakersComponent),
        data: { title: 'Speakers' },
        providers: [DataService],
    },
    {
        path: 'speakers/:id/:seo',
        loadComponent: () =>
            import('./speakers-view.component').then((m) => m.SpeakersViewComponent),
        data: { title: false },
        providers: [DataService],
    },
    {
        path: 'schedule',
        loadComponent: () => import('./schedule.component').then((m) => m.ScheduleComponent),
        data: { title: 'Schedule' },
    },
    {
        path: 'schedule/:id/feedback',
        loadComponent: () =>
            import('./session-feedback.component').then((m) => m.SessionFeedbackComponent),
        data: { title: 'Session Feedback' },
    },
    {
        path: 'schedule/:id/:seo',
        loadComponent: () => import('./session-view.component').then((m) => m.SessionViewComponent),
        data: { title: false },
    },
    {
        path: 'tickets',
        loadComponent: () => import('../tickets/tickets.component').then((m) => m.TicketsComponent),
        data: { title: 'Tickets' },
    },
    {
        path: 'past',
        loadComponent: () => import('../past/past.component').then((m) => m.PastComponent),
        data: { title: 'Past DevFestMN Events' },
    },
    {
        path: 'conduct',
        loadComponent: () => import('../conduct/conduct.component').then((m) => m.ConductComponent),
        data: { title: 'Code of Conduct' },
    },
    { path: 'admin', loadChildren: () => AdminRoutes },
];

export default MainRoutes;
