import { Component, inject } from '@angular/core';
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

  sessions = this.ds.schedule;
}
