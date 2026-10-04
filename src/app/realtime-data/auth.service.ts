import { Injectable, inject, signal, computed, Signal, DestroyRef } from '@angular/core';
import { User, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { ref } from 'firebase/database';

import { environment } from '../../environments/environment';
import { AUTH, DATABASE, listResource, objectResource } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
    auth = inject(AUTH);
    provider = new GoogleAuthProvider();
    db = inject(DATABASE);

    /** `undefined` until Firebase reports the initial auth state; always `null` during SSR. */
    private user = signal<User | null | undefined>(this.auth ? undefined : null);

    uid: Signal<string | null> = computed(() => this.user()?.uid);
    name: Signal<string | null> = computed(
        () => this.user()?.displayName || this.user()?.providerData[0]?.displayName
    );

    agenda = listResource<{ key: string; value?: boolean }>(() => {
        const uid = this.uid();
        return uid ? ref(this.db, `devfest${environment.year}/agendas/${uid}`) : undefined;
    }, 'key');

    // Non-admins get permission denied reading /admin, which resolves to false.
    isAdmin = objectResource<boolean>(
        () => (this.uid() ? ref(this.db, `/admin/${this.uid()}`) : undefined),
        { initialValue: false }
    );

    constructor() {
        if (this.auth) {
            const unsubscribe = onAuthStateChanged(this.auth, (user) => this.user.set(user));
            inject(DestroyRef).onDestroy(unsubscribe);
        }
    }

    login() {
        if (!this.auth) {
            console.warn('Login attempted in SSR context');
            return Promise.resolve(null);
        }

        return signInWithPopup(this.auth, this.provider).then((result) => {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (window && window.localStorage) {
                window.localStorage['authentication'] = 'active';
            }
            return credential;
        });
    }
    logout() {
        if (!this.auth) {
            console.warn('Logout attempted in SSR context');
            return;
        }

        this.auth.signOut();
    }
}
