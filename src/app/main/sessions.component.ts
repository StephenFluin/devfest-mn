import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataService } from '../shared/data.service';

import { AuthService } from '../realtime-data/auth.service';

@Component({
  templateUrl: './sessions.component.html',
  imports: [RouterLink],
})
export class SessionsComponent {
  ds = inject(DataService);
  router = inject(Router);
  auth = inject(AuthService);

  /** Admins also see unpublished sessions, such as new speakers' sessions without a time yet. */
  sessions = computed(() =>
    this.auth.isAdmin() ? this.ds.schedule() : this.ds.publishedSchedule(),
  );
}
