import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';

import { YearService } from '../year.service';
import { Database, list, objectVal, ref } from '@angular/fire/database';
import 'firebase/compat/auth';
import { combineLatest, EMPTY as observableEmpty, Observable, of as observableOf } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Feedback } from '../shared/data.service';
import { localstorageCache } from '../shared/localstorage-cache.operator';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private auth = inject(Auth);
    provider = new GoogleAuthProvider();
    private db = inject(Database);

    isAdmin: Observable<boolean>;
    isVolunteer: Observable<boolean>;
    isAdminOrVolunteer: Observable<boolean>;
    uid: Observable<string>;
    name: Observable<string>;

    agenda: Observable<any>;
    feedback: Observable<Feedback>;

    state = authState(this.auth).pipe(shareReplay(1));

    constructor() {
        console.log('Auth service loaded.');
        const yearService = inject(YearService);

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
                    let year = yearService.year;
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
            localstorageCache(`agendaCache${yearService.year}`)
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
        signInWithPopup(this.auth, this.provider).then((result) => {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            return credential;
        });
    }
    logout() {
        this.auth.signOut();
    }
}
