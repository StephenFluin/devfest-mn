import { inject, Injectable } from '@angular/core';
import { AuthService } from './realtime-data/auth.service';

@Injectable({
    providedIn: 'root',
})
export class AuthenticationShimService {
    authService: AuthService | null = null;
    constructor() {
        console.log('AuthenticationShimService loaded');
        if (window?.localStorage?.['authentication']) {
            this.loadTrueService();
        }
    }
    enableTrueService() {
        if (!window || !window.localStorage) {
            // SSR noop
            return;
        }
        window.localStorage['authentication'] = true;
        this.loadTrueService();
    }

    loadTrueService() {
        console.log('loading true authentication service');
        import('./realtime-data/auth.service').then((m) => {
            this.authService = inject(m.AuthService);
        });
    }
}
