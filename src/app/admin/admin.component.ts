import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';

@Component({
    // Material's prebuilt theme is light-only, so admin pages opt out of dark mode.
    host: { class: 'light-only' },
    templateUrl: './admin.component.html',
    imports: [RouterLink, RouterOutlet],
})
export class AdminComponent {
    auth = inject(AuthService);
}
