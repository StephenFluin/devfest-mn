import { inject } from '@angular/core';
import { CanMatchFn, Routes } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';
import { environment } from '../../environments/environment';
import { eventUtcOffset } from '../shared/event-data';

/**
 * The database rules are what actually protect admin data; this keeps non-admins from loading
 * the admin pages at all. Returning false (not a redirect) lets /admin fall through to the home
 * page, which shows the login button.
 */
/** Midnight in Minneapolis at the start of the event day. */
const eventDayStart = new Date(`${environment.eventDate}T00:00:00${eventUtcOffset}`).getTime();

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
          // /admin opens on ticket sales until the event, then on the overview. This has to
          // come first: the guarded group below has an empty path, so for admins it would
          // otherwise match /admin with no page to show.
          {
            path: '',
            pathMatch: 'full',
            redirectTo: () => (Date.now() < eventDayStart ? 'burndown' : 'overview'),
          },
          // Not guarded: it tells non-admins they aren't one yet.
          {
            path: 'overview',
            loadComponent: () => import('./admin-home.component').then((m) => m.AdminHomeComponent),
          },
          {
            path: '',
            canMatch: [isAdmin],
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
                path: 'admins',
                loadComponent: () => import('./admins.component').then((m) => m.AdminsComponent),
              },
              {
                path: 'rooms',
                loadComponent: () => import('./rooms.component').then((m) => m.RoomsComponent),
              },
              {
                path: 'session-report',
                loadComponent: () =>
                  import('./session-report.component').then((m) => m.SessionReportComponent),
              },
              {
                path: 'reports',
                loadComponent: () => import('./reports.component').then((m) => m.ReportsComponent),
              },
              {
                path: 'burndown',
                loadComponent: () =>
                  import('./burndown.component').then((m) => m.BurndownComponent),
              },
              {
                path: 'utm-funnel',
                loadComponent: () =>
                  import('./utm-funnel.component').then((m) => m.UtmFunnelComponent),
              },
              {
                path: 'volunteers',
                loadComponent: () =>
                  import('./volunteers.component').then((m) => m.VolunteersComponent),
              },
              {
                path: 'events',
                loadComponent: () => import('./events.component').then((m) => m.EventsComponent),
              },
            ],
          },
          // Pages someone can't open (or that don't exist) go to the overview, not /admin,
          // which for a non-admin before the event would loop through ticket sales.
          { path: '**', redirectTo: 'overview' },
        ],
      },
    ],
  },
];

export default AdminRoutes;
