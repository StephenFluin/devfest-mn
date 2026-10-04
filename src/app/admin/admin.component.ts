import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';

@Component({
    templateUrl: './admin.component.html',
    imports: [RouterLink, RouterOutlet],
})
export class AdminComponent {
    auth = inject(AuthService);
}
