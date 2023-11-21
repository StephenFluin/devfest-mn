import { Routes } from '@angular/router';
import { AdminHomeComponent } from './admin-home.component';
import { AdminComponent } from './admin.component';
import { EventsComponent } from './events.component';
import { ManageCFPsComponent } from './manage-cfps.component';
import { ReportsComponent } from './reports.component';
import { SessionEditComponent } from './session-edit.component';
import { SessionReportComponent } from './session-report.component';
import { SpeakerEditComponent } from './speaker-edit.component';
import { VolunteersComponent } from './volunteers.component';

export const AdminRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        providers: [],
        children: [
            {
                path: '',
                component: AdminComponent,
                children: [
                    { path: 'speakers/:id/edit', component: SpeakerEditComponent },
                    { path: 'sessions/:id/edit', component: SessionEditComponent },
                    { path: 'sessions/:id/edit/:time/:room', component: SessionEditComponent },
                    { path: 'session-report', component: SessionReportComponent },
                    { path: '', component: AdminHomeComponent },
                    { path: 'reports', component: ReportsComponent },
                    { path: 'volunteers', component: VolunteersComponent },
                    { path: 'cfps', component: ManageCFPsComponent },
                    { path: 'events', component: EventsComponent },
                ],
            },
        ],
    },
];

export default AdminRoutes;
