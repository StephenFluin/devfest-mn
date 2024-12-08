import { Routes } from '@angular/router';







export const MainRoutes: Routes = [
    { path: 'sessions', loadComponent: () => import('./sessions.component').then(m => m.SessionsComponent), data: { title: 'Sessions', depth: 1 } },
    { path: 'speakers', loadComponent: () => import('./speakers.component').then(m => m.SpeakersComponent), data: { title: 'Speakers', depth: 1 } },
    {
        path: 'speakers/:id/:seo',
        loadComponent: () => import('./speakers-view.component').then(m => m.SpeakersViewComponent),
        data: { title: false, depth: 2 },
    },
    { path: 'schedule', loadComponent: () => import('./schedule.component').then(m => m.ScheduleComponent), data: { title: 'Schedule', depth: 1 } },
    {
        path: 'schedule/:id/feedback',
        loadComponent: () => import('./session-feedback.component').then(m => m.SessionFeedbackComponent),
        data: { title: 'Session Feedback', depth: 2 },
    },
    {
        path: 'schedule/:id/:seo',
        loadComponent: () => import('./session-view.component').then(m => m.SessionViewComponent),
        data: { title: false, depth: 2 },
    },
];

export default MainRoutes;
