import { inject, Injectable } from '@angular/core';
import { AuthService } from './realtime-data/auth.service';

@Injectable({
    providedIn: 'root',
})
export class AuthenticationShimService {
    authService: AuthService | null = inject(AuthService, { optional: true });
    // constructor() {
    //     console.log('AuthenticationShimService loaded');
    //     if (typeof window !== 'undefined' && window?.localStorage?.['authentication']) {
    //         this.loadTrueService();
    //     }
    // }
    // enableTrueService() {
    //     if (!window || !window.localStorage) {
    //         // SSR noop
    //         return;
    //     }
    //     console.log('Enabling true authentication service');
    //     window.localStorage['authentication'] = 'active';
    //     this.loadTrueService();
    // }

    // loadTrueService() {
    //     console.log('loading true authentication service');
    //     import('./realtime-data/auth.service').then((m) => {
    //         this.authService = inject(m.AuthService);
    //     });
    // }
}
