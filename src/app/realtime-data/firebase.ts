import { inject, Injectable, InjectionToken, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { pendingUntilEvent } from '@angular/core/rxjs-interop';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Database, DataSnapshot, getDatabase, onValue, Query, ref } from 'firebase/database';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FirebaseApp', {
    providedIn: 'root',
    factory: () => (getApps().length ? getApp() : initializeApp(environment.firebaseConfig)),
});

export const DATABASE = new InjectionToken<Database>('Database', {
    providedIn: 'root',
    factory: () => getDatabase(inject(FIREBASE_APP)),
});

/** Auth only exists in the browser; there is never a signed-in user during SSR. */
export const AUTH = new InjectionToken<Auth | null>('Auth', {
    providedIn: 'root',
    factory: () =>
        isPlatformBrowser(inject(PLATFORM_ID)) ? getAuth(inject(FIREBASE_APP)) : null,
});

export function authState(auth: Auth): Observable<User | null> {
    return new Observable((subscriber) =>
        onAuthStateChanged(
            auth,
            (user) => subscriber.next(user),
            (error) => subscriber.error(error)
        )
    );
}

/**
 * Realtime Database reads as observables. Each one holds the app unstable until its first
 * value arrives, so SSR waits for data before rendering.
 */
@Injectable({ providedIn: 'root' })
export class Rtdb {
    readonly db = inject(DATABASE);
    private injector = inject(Injector);

    ref(path: string) {
        return ref(this.db, path);
    }

    objectVal<T>(query: Query): Observable<T | null> {
        return this.watch(query, (snapshot) => snapshot.val());
    }

    /** Children in query order; object values get their key copied into `keyField`. */
    listVal<T>(query: Query, keyField?: string): Observable<T[]> {
        return this.watch(query, (snapshot) => {
            const items = [];
            snapshot.forEach((child) => {
                const value = child.val();
                items.push(
                    keyField && value !== null && typeof value === 'object'
                        ? { ...value, [keyField]: child.key }
                        : value
                );
            });
            return items;
        });
    }

    private watch<T>(query: Query, toValue: (snapshot: DataSnapshot) => T): Observable<T> {
        return new Observable<T>((subscriber) =>
            onValue(
                query,
                (snapshot) => subscriber.next(toValue(snapshot)),
                (error) => subscriber.error(error)
            )
        ).pipe(pendingUntilEvent(this.injector));
    }
}
