import { Component, DOCUMENT, inject, VERSION } from '@angular/core';
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

    constructor() {
        // Only admin pages use Material components, so the theme (built separately in
        // angular.json) is loaded here instead of blocking every public page.
        const doc = inject(DOCUMENT);
        if (!doc.getElementById('material-theme')) {
            const link = doc.createElement('link');
            link.id = 'material-theme';
            link.rel = 'stylesheet';
            // The file name isn't hashed; the version busts the long-lived static cache.
            link.href = `/material-theme.css?v=${VERSION.full}`;
            doc.head.appendChild(link);
        }
    }
}
