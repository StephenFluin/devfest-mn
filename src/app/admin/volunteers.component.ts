import { Component } from '@angular/core';
import { environment } from '../../environments/environment';
import { EmailInvitesComponent } from './email-invites.component';

@Component({
  template: `
    <div class="page-header">
      <div>
        <h2>Volunteers</h2>
        <p class="muted">
          Add volunteers by the email address of their Google account; they're recorded as
          volunteers the next time they sign in.
        </p>
      </div>
    </div>
    <app-email-invites
      [invitesPath]="'devfest' + year + '/volunteerEmails'"
      [recordsPath]="'devfest' + year + '/volunteers'"
      noun="volunteer"
    />
  `,
  imports: [EmailInvitesComponent],
})
export class VolunteersComponent {
  readonly year = environment.year;
}
