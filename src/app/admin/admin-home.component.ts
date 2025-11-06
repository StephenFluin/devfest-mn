import { Component, inject } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';

@Component({
    selector: 'app-admin-home',
    template: `
        @if (auth.isAdmin()) {
        <div>
            <p></p>
            <p style="margin:16px 0;">Welcome to the administrator portal.</p>
            <p>Schedule and session data is now managed from their main pages.</p>
        </div>
        } @else { You aren't an administrator or volunteer, so you can't access this section, sorry!
        }
    `,
    styles: [],
    imports: [],
})
export class AdminHomeComponent {
    auth = inject(AuthService);
}
