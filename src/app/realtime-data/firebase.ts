import {
    computed,
    inject,
    InjectionToken,
    makeStateKey,
    PLATFORM_ID,
    resource,
    ResourceStreamItem,
    Signal,
    signal,
    TransferState,
    WritableSignal,
} from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Database, DataSnapshot, getDatabase, onValue, Query } from 'firebase/database';
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

export interface RtdbOptions<T> {
    /** Value while loading, when there is no query, or if the read fails (e.g. permission denied). */
    initialValue: T;
    /** Hand the server-rendered value to the browser so hydration doesn't flash empty. */
    transferKey?: string;
    /** Remember the last value in localStorage and start from it on the next visit. */
    localStorageKey?: string;
}

/**
 * A live signal of the data at `query()`. Listens while the owning injector is alive, re-listens
 * when the query changes, and keeps SSR waiting until the first value arrives. Must be created in
 * an injection context.
 */
export function rtdbResource<T>(
    query: () => Query | undefined,
    read: (snapshot: DataSnapshot) => T,
    { initialValue, transferKey, localStorageKey }: RtdbOptions<T>
): Signal<T> {
    const transferState = inject(TransferState);
    const isServer = isPlatformServer(inject(PLATFORM_ID));
    const stateKey = transferKey ? makeStateKey<T>(transferKey) : undefined;
    // Node has its own global localStorage, which would be shared between SSR requests.
    const cacheKey = isServer ? undefined : localStorageKey;
    const seed =
        (stateKey && transferState.get(stateKey, null)) ??
        readLocal<T>(cacheKey) ??
        initialValue;

    const res = resource({
        params: query,
        defaultValue: seed,
        stream: ({ params, abortSignal }) =>
            new Promise<Signal<ResourceStreamItem<T>>>((resolve) => {
                let stream: WritableSignal<ResourceStreamItem<T>> | undefined;
                const emit = (item: ResourceStreamItem<T>) => {
                    if (stream) {
                        stream.set(item);
                    } else {
                        resolve((stream = signal(item)));
                    }
                };
                const unsubscribe = onValue(
                    params,
                    (snapshot) => {
                        const value = read(snapshot);
                        if (isServer && stateKey) {
                            transferState.set(stateKey, value);
                        }
                        writeLocal(cacheKey, value);
                        emit({ value });
                    },
                    (error) => emit({ error })
                );
                abortSignal.addEventListener('abort', unsubscribe);
            }),
    });

    return computed(() => (res.error() ? initialValue : res.value()));
}

export function objectResource<T>(query: () => Query | undefined, options: RtdbOptions<T>) {
    return rtdbResource<T>(query, (snapshot) => snapshot.val() ?? options.initialValue, options);
}

/** Children in query order; object values get their key copied into `keyField`. */
export function listResource<T>(
    query: () => Query | undefined,
    keyField: string,
    options: Omit<RtdbOptions<T[]>, 'initialValue'> = {}
) {
    return rtdbResource<T[]>(
        query,
        (snapshot) => {
            const items = [];
            snapshot.forEach((child) => {
                const value = child.val();
                items.push(
                    value !== null && typeof value === 'object'
                        ? { ...value, [keyField]: child.key }
                        : value
                );
            });
            return items;
        },
        { initialValue: [], ...options }
    );
}

function readLocal<T>(key: string | undefined): T | undefined {
    try {
        return key ? JSON.parse(localStorage[key]) : undefined;
    } catch {
        return undefined;
    }
}

function writeLocal(key: string | undefined, value: unknown) {
    try {
        if (key) localStorage[key] = JSON.stringify(value);
    } catch {}
}
