import { Component } from '@angular/core';
import { EmailInvitesComponent } from './email-invites.component';

@Component({
  template: `
    <div class="page-header">
      <div>
        <h2>Admins</h2>
        <p class="muted">
          Admins can see every page here and edit everything. Add someone by the email address of
          their Google account; they get access the next time they sign in.
        </p>
      </div>
    </div>
    <app-email-invites
      invitesPath="adminEmails"
      recordsPath="admin"
      noun="admin"
      [protectSelf]="true"
    />
  `,
  imports: [EmailInvitesComponent],
})
export class AdminsComponent {}
