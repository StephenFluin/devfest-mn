import {
    DestroyRef,
    Injectable,
    PLATFORM_ID,
    afterNextRender,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ref, remove, set } from 'firebase/database';

import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { DATABASE, listResource } from '../realtime-data/firebase';
import { DataService } from './data.service';

const STORAGE_KEY = `agenda${environment.year}`;

/**
 * The talks someone has saved to My Agenda.
 *
 * Signed out, saved talks live in this browser's localStorage. Signed in, they live in the
 * database at agendas/<uid>, so they follow the person between devices. When someone with talks
 * saved on this device signs in, those talks are copied into their account and then cleared here,
 * so they don't reappear for whoever uses this browser after they sign out. Until a copy succeeds
 * (offline, say) the talk stays here and still shows as saved.
 */
@Injectable({ providedIn: 'root' })
export class AgendaService {
    private auth = inject(AuthService);
    private ds = inject(DataService);
    private db = inject(DATABASE);

    /**
     * Saved on this device and not (yet) in an account. Read after the first render, so hydration
     * matches the server-rendered page (and the server never reads its own localStorage).
     */
    private local = signal<string[]>([]);

    private remote = listResource<{ key: string; value?: boolean }>(() => {
        const uid = this.auth.uid();
        return uid ? this.agendaRef(uid) : undefined;
    }, 'key');

    /** Keys of every saved talk, from this device and the signed-in account. */
    keys = computed(
        () =>
            new Set([
                ...this.local(),
                ...this.remote()
                    .filter((item) => item.value)
                    .map((item) => item.key),
            ])
    );

    /** Talks being copied into the account right now, so each is only written once. */
    private copying = new Set<string>();

    constructor() {
        if (!isPlatformBrowser(inject(PLATFORM_ID))) {
            return;
        }
        afterNextRender(() => this.local.set(readStored()));
        // Keep tabs in step when another tab saves or removes a talk.
        const onStorage = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY || event.key === null) {
                this.local.set(readStored());
            }
        };
        window.addEventListener('storage', onStorage);
        inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));

        effect(() => this.copyToAccount());
    }

    has(key: string | undefined): boolean {
        return !!key && this.keys().has(key);
    }

    add(key: string) {
        const uid = this.auth.uid();
        if (uid) {
            set(this.agendaRef(uid, key), { value: true }).catch((error) =>
                console.error('failure while saving user agenda', error)
            );
        } else {
            this.setLocal([...new Set([...this.local(), key])]);
        }
    }

    remove(key: string) {
        this.setLocal(this.local().filter((item) => item !== key));
        const uid = this.auth.uid();
        if (uid) {
            remove(this.agendaRef(uid, key)).catch((error) =>
                console.error('failure while removing from user agenda', error)
            );
        }
    }

    /**
     * Moves talks saved on this device into the signed-in account. Waits for the schedule, because
     * the database only accepts talks that exist; talks that have since been removed from the
     * schedule are dropped instead.
     */
    private copyToAccount() {
        const uid = this.auth.uid();
        const pending = this.local();
        if (!uid || !pending.length || !this.ds.schedule.loaded()) {
            return;
        }
        const scheduled = new Set(this.ds.schedule().map((session) => session.$key));
        const gone = pending.filter((key) => !scheduled.has(key));
        if (gone.length) {
            this.setLocal(pending.filter((key) => scheduled.has(key)));
            return;
        }
        for (const key of pending) {
            if (this.copying.has(key)) continue;
            this.copying.add(key);
            set(this.agendaRef(uid, key), { value: true })
                .then(() => {
                    // Only clear it if the same person is still signed in.
                    if (this.auth.uid() === uid) {
                        this.setLocal(this.local().filter((item) => item !== key));
                    }
                })
                .catch((error) => console.error('failure while copying saved talk to account', error))
                .finally(() => this.copying.delete(key));
        }
    }

    private agendaRef(uid: string, key?: string) {
        const path = `devfest${environment.year}/agendas/${uid}`;
        return ref(this.db, key ? `${path}/${key}` : path);
    }

    private setLocal(keys: string[]) {
        this.local.set(keys);
        try {
            if (keys.length) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // Private browsing or storage disabled: keep them for this visit only.
        }
    }
}

function readStored(): string[] {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(stored) ? stored.filter((key) => typeof key === 'string') : [];
    } catch {
        return [];
    }
}
