import { Injectable, computed, inject } from '@angular/core';
import { ref, query, orderByChild, push, update, remove, set } from 'firebase/database';
import { SafeHtml } from '@angular/platform-browser';
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
    renderedDescription?: SafeHtml;
    notes?: string;
    adminNotes?: string;
}

export interface Speaker {
    $key?: string;
    name?: string;
    bio?: string;
    renderedBio?: SafeHtml;
    confirmed?: boolean;
    company?: string;
    twitter?: string;
    imageUrl?: string;
    website?: string;
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

    save(path: 'schedule' | 'speakers', item) {
        console.log('Attempting to save', path, item);
        const dbRef = ref(this.db, `devfest${environment.year}/${path}`);
        let result;
        if (item.$key) {
            let key = item.$key;
            delete item.$key;
            const itemRef = ref(this.db, `devfest${environment.year}/${path}/${key}`);
            result = update(itemRef, item);
            item.$key = key;
        } else {
            console.log('Pushing new item to', path, item);
            // check item for any undefined properties and set them to null
            Object.keys(item).forEach((prop) => {
                if (item[prop] === undefined) {
                    item[prop] = null;
                }
            });
            result = push(dbRef, item);
        }
        return result;
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
