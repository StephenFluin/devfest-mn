import { Injectable, computed, inject } from '@angular/core';
import {
    ref,
    query,
    orderByChild,
    push,
    update,
    remove,
    set,
    serverTimestamp,
} from 'firebase/database';
import { environment } from '../../environments/environment';
import { DATABASE, listResource } from '../realtime-data/firebase';

export interface Session {
    $key?: string;
    room?: string;
    startTime?: string;
    title?: string;
    description?: string;
    track?: string;
    speakers?: any[];
    blocks?: number;
    /** Markdown rendered to HTML. Left for Angular to sanitize when bound to [innerHTML]. */
    renderedDescription?: string;
    notes?: string;
    /** Only in the session editor; stored separately at adminNotes/<session>. */
    adminNotes?: string;
    /** Server time (ms) of the last save in the admin. */
    updatedAt?: number;
}

export interface Speaker {
    $key?: string;
    name?: string;
    bio?: string;
    /** Markdown rendered to HTML. Left for Angular to sanitize when bound to [innerHTML]. */
    renderedBio?: string;
    confirmed?: boolean;
    company?: string;
    twitter?: string;
    imageUrl?: string;
    website?: string;
    /** Full LinkedIn profile URL. */
    linkedin?: string;
    /** Server time (ms) of the last save in the admin. */
    updatedAt?: number;
}

export interface Feedback {
    $key?: string;
    speaker: number;
    content: number;
    recommendation: number;
    comment: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
    db = inject(DATABASE);
    private year = environment.year;

    speakers = listResource<Speaker>(
        () => query(this.ref('speakers'), orderByChild('name')),
        '$key',
        { transferKey: `speakers-${this.year}`, localStorageKey: `speakerCache${this.year}` }
    );

    schedule = listResource<Session>(
        () => query(this.ref('schedule'), orderByChild('title')),
        '$key',
        { transferKey: `schedule-${this.year}`, localStorageKey: `sessionsCache${this.year}` }
    );

    private speakerMap = computed(() => new Map(this.speakers().map((s) => [s.$key, s])));

    speaker(key: string): Speaker | undefined {
        return this.speakerMap().get(key);
    }

    /** Sessions the speaker is presenting, from each session's speakers map (id -> speaker key). */
    sessionsFor(speakerKey: string | undefined): Session[] {
        if (!speakerKey) return [];
        return this.schedule().filter((session) =>
            Object.values(session.speakers ?? {}).includes(speakerKey)
        );
    }

    agendaRef(uid: string, session: string) {
        return this.ref(`agendas/${uid}/${session}`);
    }

    // @TODO this method is called much too often
    // We should get this from the data, but then how to control ordering?
    getVenueLayout() {
        let rooms, floors;

        rooms = ['Main Auditorium'];
        floors = {
            'Main Auditorium': 1,
        };

        return { floors: floors, rooms: rooms, hasFloors: false };
    }

    /**
     * Takes in an ISO 8601 datetime string
     * returns a friendly time e.g. "8 PM" in Minnesota Time
     */
    customDateFormatter(isoDateTime) {
        let dateTime = new Date(isoDateTime);
        if (dateTime.toString() != 'Invalid Date') {
            //Check if is actually a DATE.... otherwise look for AMPM
            let time = dateTime.getHours();
            let min = dateTime.getMinutes();
            time -= 6 - dateTime.getTimezoneOffset() / 60;
            let indicator = time >= 12 && time < 24 ? 'PM' : 'AM';
            if (time > 12) {
                time -= 12;
            }
            if (min == 0) {
                return `${time} ${indicator}`;
            } else {
                return `${time}:${String(min).padStart(2, '0')} ${indicator}`;
            }
        } else {
            if (isoDateTime.toString().toLowerCase().indexOf('am') == -1) {
                return 'PM';
            } else {
                return 'AM';
            }
        }
    }

    /** Saves an edited item, or creates one; for a new item the result's key is its id. */
    save(path: 'schedule' | 'speakers', item): PromiseLike<unknown> & { key?: string | null } {
        console.log('Attempting to save', path, item);
        // updatedAt (server time) drives the sitemap's lastmod and busts cached share cards.
        const { $key: key, ...data } = { ...item, updatedAt: serverTimestamp() };
        // Firebase rejects undefined values, so send null (which also clears the field).
        Object.keys(data).forEach((prop) => {
            if (data[prop] === undefined) {
                data[prop] = null;
            }
        });
        if (key) {
            return update(ref(this.db, `devfest${environment.year}/${path}/${key}`), data);
        }
        console.log('Pushing new item to', path, data);
        return push(ref(this.db, `devfest${environment.year}/${path}`), data);
    }

    delete(path: 'schedule' | 'speakers', item) {
        console.log('Attempting to delete', item, 'of type', path);
        const itemRef = ref(this.db, `devfest${environment.year}/${path}/${item.$key}`);
        remove(itemRef);
    }

    deleteSpeakerFromSession(session: Session, speakerKey: string) {
        const speakerRef = ref(
            this.db,
            `devfest${environment.year}/schedule/${session.$key}/speakers/${speakerKey}`
        );
        remove(speakerRef)
            .then(() => {
                console.log(`Speaker (${speakerKey} deleted from session (${session.$key}) .`);
            })
            .catch((err) => {
                console.error('Error deleting speaker from session', err);
            });
    }

    ref(path: string) {
        return ref(this.db, `devfest${this.year}/${path}`);
    }
}
