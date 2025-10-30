import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth, authState, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

import { environment } from '../../environments/environment';
import { Database, list, objectVal, ref } from '@angular/fire/database';
import 'firebase/compat/auth';
import { combineLatest, EMPTY as observableEmpty, Observable, of as observableOf } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Feedback } from '../shared/data.service';
import { localstorageCache } from '../shared/localstorage-cache.operator';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private auth = inject(Auth, { optional: true });
    provider = new GoogleAuthProvider();
    private db = inject(Database, { optional: true });
    private platformId = inject(PLATFORM_ID);

    isAdmin: Observable<boolean>;
    isVolunteer: Observable<boolean>;
    isAdminOrVolunteer: Observable<boolean>;
    uid: Observable<string>;
    name: Observable<string>;

    agenda: Observable<any>;
    feedback: Observable<Feedback>;

    state =
        isPlatformBrowser(this.platformId) && this.auth
            ? authState(this.auth).pipe(shareReplay(1))
            : observableOf(null).pipe(shareReplay(1));

    constructor() {
        console.log('Auth service loaded.');

        // Return null observables for SSR context
        if (!isPlatformBrowser(this.platformId) || !this.auth || !this.db) {
            this.uid = observableOf(null);
            this.name = observableOf(null);
            this.agenda = observableOf([]);
            this.isAdmin = observableOf(false);
            this.isVolunteer = observableOf(false);
            this.isAdminOrVolunteer = observableOf(false);
            this.feedback = observableOf(null);
            return;
        }

        // Defer Firebase API calls using defer operator to ensure they're in proper injection context
        this.uid = this.state.pipe(
            map((authState) => {
                if (authState) {
                    return authState.uid;
                } else {
                    return null;
                }
            })
        );
        this.name = this.state.pipe(
            map((authState) => {
                if (authState) {
                    return authState.displayName || authState.providerData[0].displayName;
                } else {
                    return null;
                }
            })
        );
        /** Used to filter the agenda of a user on the schedule */
        this.agenda = this.state.pipe(
            switchMap((authState) => {
                if (authState && authState.uid) {
                    let year = environment.year;
                    return list(ref(this.db, `devfest${year}/agendas/${authState.uid}`)).pipe(
                        map((actions) =>
                            actions.map((a) => {
                                const value = a.snapshot.val();
                                const key = a.snapshot.key;
                                console.log('payload includes', a.snapshot.val());
                                return { key: key, ...value };
                            })
                        )
                    );
                } else {
                    return observableEmpty;
                }
            }),
            localstorageCache(`agendaCache${environment.year}`)
        );

        this.isAdmin = this.state.pipe(
            switchMap((authState) => {
                if (!authState) {
                    return observableOf(false);
                } else {
                    return objectVal(ref(this.db, '/admin/' + authState.uid));
                }
            }),
            map((value) => !!value),
            localstorageCache('isAdmin')
        );

        this.isVolunteer = this.state
            .pipe(
                switchMap((authState) => {
                    if (!authState) {
                        return observableOf(false);
                    } else {
                        return objectVal(ref(this.db, '/devfest2025/volunteers/' + authState.uid));
                    }
                })
            )
            .pipe(map((volunteerObject) => volunteerObject && volunteerObject['$value'] === true));

        this.isAdminOrVolunteer = combineLatest(this.isAdmin, this.isVolunteer, (x, y) => x || y);
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
