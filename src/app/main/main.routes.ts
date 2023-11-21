import { Routes } from '@angular/router';
import { ScheduleComponent } from './schedule.component';
import { SessionFeedbackComponent } from './session-feedback.component';
import { SessionViewComponent } from './session-view.component';
import { SessionsComponent } from './sessions.component';
import { SpeakersViewComponent } from './speakers-view.component';
import { SpeakersComponent } from './speakers.component';

export const MainRoutes: Routes = [
    { path: 'sessions', component: SessionsComponent, data: { title: 'Sessions', depth: 1 } },
    { path: 'speakers', component: SpeakersComponent, data: { title: 'Speakers', depth: 1 } },
    {
        path: 'speakers/:id/:seo',
        component: SpeakersViewComponent,
        data: { title: false, depth: 2 },
    },
    { path: 'schedule', component: ScheduleComponent, data: { title: 'Schedule', depth: 1 } },
    {
        path: 'schedule/:id/feedback',
        component: SessionFeedbackComponent,
        data: { title: 'Session Feedback', depth: 2 },
    },
    {
        path: 'schedule/:id/:seo',
        component: SessionViewComponent,
        data: { title: false, depth: 2 },
    },
];

export default MainRoutes;
