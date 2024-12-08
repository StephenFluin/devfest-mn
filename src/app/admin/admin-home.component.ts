import { Component } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-admin-home',
    template: `
  @if (auth.isAdmin | async) {
    <div><p></p>
    <p style="margin:16px 0;">
    Welcome to the administrator portal.</p>
    <p>Schedule and session data is now managed from their main pages.
    </p>
  </div>
  } @else {
    You aren't an administrator or voulnteer, so you can't access this section, sorry!
  }
  `,
    styles: [],
    imports: [AsyncPipe]
})
export class AdminHomeComponent {

  constructor(public auth: AuthService) { }

}
