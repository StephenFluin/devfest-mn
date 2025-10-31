import { Injectable, inject, PLATFORM_ID, signal, computed, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth, authState, User, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

import { environment } from '../../environments/environment';
import { Database, list, objectVal, ref } from '@angular/fire/database';
import { map } from 'rxjs/operators';
import { Feedback } from '../shared/data.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class AuthService {
    auth = inject(Auth, { optional: true });
    provider = new GoogleAuthProvider();
    db = inject(Database, { optional: true });
    platformId = inject(PLATFORM_ID);

    feedback = signal<Feedback | null>(null);

    authStateSignal = toSignal(authState(this.auth));

    state =
        isPlatformBrowser(this.platformId) && this.auth ? this.authStateSignal : signal<User>(null);

    uid: Signal<string | null> = computed(() => this.state()?.uid);
    name: Signal<string | null> = computed(
        () => this.state()?.displayName || this.state()?.providerData[0]?.displayName
    );

    agenda: Signal<any[] | null> = computed(() => {
        if (!this.uid()) return null;
        const agenda = toSignal(
            list(ref(this.db, `devfest${environment.year}/agendas/${this.uid()}`)).pipe(
                map((actions) =>
                    actions.map((a) => {
                        const value = a.snapshot.val();
                        const key = a.snapshot.key;
                        console.log('payload includes', a.snapshot.val());
                        return { key: key, ...value };
                    })
                )
            )
        );
    });

    isAdmin = this.checkKey(`/devfest${environment.year}/admin/`, this.uid);
    isVolunteer = this.checkKey(`/devfest${environment.year}/volunteers/`, this.uid);

    isAdminOrVolunteer = computed(() => this.isAdmin() || this.isVolunteer());

    checkKey(key: string, uid: Signal<string>): Signal<boolean> {
        return computed(() => {
            if (!uid()) return false;
            else console.log(uid());
            const keyVal = objectVal(ref(this.db, key + uid()));
            return !!keyVal;
        });
    }

    constructor() {
        console.log('Auth service loaded.');
    }
    login() {
        if (!isPlatformBrowser(this.platformId) || !this.auth) {
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
        if (!isPlatformBrowser(this.platformId) || !this.auth) {
            console.warn('Logout attempted in SSR context');
            return;
        }

        this.auth.signOut();
    }
}
