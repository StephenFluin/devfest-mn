import { Injectable, inject, PLATFORM_ID, signal, computed, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { ref } from 'firebase/database';

import { environment } from '../../environments/environment';
import { AUTH, authState, Rtdb } from './firebase';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Feedback } from '../shared/data.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
    auth = inject(AUTH);
    provider = new GoogleAuthProvider();
    private rtdb = inject(Rtdb);
    db = this.rtdb.db;
    platformId = inject(PLATFORM_ID);

    feedback = signal<Feedback | null>(null);

    state: Signal<User | null | undefined> = this.auth
        ? toSignal(authState(this.auth))
        : signal<User>(null);

    uid: Signal<string | null> = computed(() => this.state()?.uid);
    name: Signal<string | null> = computed(
        () => this.state()?.displayName || this.state()?.providerData[0]?.displayName
    );

    agenda = toSignal(
        toObservable(this.uid).pipe(
            switchMap((uid) =>
                uid
                    ? this.rtdb.listVal<any>(
                          ref(this.db, `devfest${environment.year}/agendas/${uid}`),
                          'key'
                      )
                    : of([])
            )
        )
    );

    isAdmin = this.checkKey(`/admin/`, this.uid);
    isVolunteer = this.checkKey(`/devfest${environment.year}/volunteers/`, this.uid);

    isAdminOrVolunteer = computed(() => this.isAdmin() || this.isVolunteer());

    checkKey(key: string, uid: Signal<string>): Signal<boolean> {
        return toSignal(
            toObservable(uid).pipe(
                switchMap((userId) => {
                    if (!userId) return of(false);
                    return this.rtdb.objectVal<boolean>(ref(this.db, key + userId)).pipe(
                        catchError(() => of(false))
                    );
                }),
                map((value) => !!value)
            ),
            { initialValue: false }
        );
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
