import { Injectable, inject } from '@angular/core';
import {
    Database,
    ref,
    list,
    object,
    query,
    orderByChild,
    DataSnapshot,
    push,
    update,
    remove,
    set,
    DatabaseReference,
    listVal,
    objectVal,
} from '@angular/fire/database';

import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { SafeHtml } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { localstorageCache } from './localstorage-cache.operator';
import { TransferStateService } from './transfer-state.service';

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

@Injectable()
export class DataService {
    db = inject(Database);
    private transferStateService = inject(TransferStateService);

    private speakersByYear: { [key: string]: Observable<Speaker[]> } = {};
    private scheduleByYear: { [key: string]: Observable<Session[]> } = {};

    getSpeakers(year: string) {
        if (this.speakersByYear[year]) {
            return this.speakersByYear[year];
        }

        const baseObservable = this.listPath('speakers', [orderByChild('name')]).pipe(
            filter((x) => !!x),
            localstorageCache('speakerCache' + year)
        );

        this.speakersByYear[year] = this.transferStateService.cacheObservable(
            `speakers-${year}`,
            baseObservable
        );

        return this.speakersByYear[year];
    }
    getSpeaker(speakerKey: string) {
        return objectVal<Speaker>(
            ref(this.db, `devfest${environment.year}/speakers/${speakerKey}/name`)
        );
    }

    getSchedule(year: string): Observable<Session[]> {
        if (this.scheduleByYear[year]) {
            return this.scheduleByYear[year];
        }

        const baseObservable = this.listPath<Session>('schedule', [orderByChild('title')]).pipe(
            filter((x) => !!x),
            localstorageCache('sessionsCache' + year)
        );

        this.scheduleByYear[year] = this.transferStateService.cacheObservable(
            `schedule-${year}`,
            baseObservable
        );

        return this.scheduleByYear[year];
    }

    // @TODO this method is called much too often
    // We should get this from the data, but then how to control ordering?
    getVenueLayout() {
        let rooms, floors;

        rooms = ['Main Auditorium'];
        floors = {
            'Main Auditorium': 3,
        };

        return { floors: floors, rooms: rooms };
    }

    getFeedback(): Observable<Feedback[]> {
        const baseObservable = this.listPath<Feedback>('feedback');
        return this.transferStateService.cacheObservable('feedback', baseObservable);
    }
    getVolunteers() {
        const dbRef = ref(this.db, `devfest${environment.year}/volunteers`);
        return {
            valueChanges: () => objectVal(dbRef),
            update: (data: any) => update(dbRef, data),
            set: (data: any) => set(dbRef, data),
            remove: () => remove(dbRef),
        };
    }

    getAgenda(uid: string, session: string) {
        const path = `devfest${environment.year}/agendas/${uid}/${session}/`;
        console.log('fetching agenda stored at', path);
        const dbRef = ref(this.db, path);
        return {
            valueChanges: () => objectVal<null | { value: boolean }>(dbRef),
            set: (data: any) => set(dbRef, data),
            remove: () => remove(dbRef),
            update: (data: any) => update(dbRef, data),
        };
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
                return `${time}:${min} ${indicator}`;
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

    listPath<T>(
        type: 'schedule' | 'speakers' | 'feedback' | 'volunteers',
        queryConstraints?: any[]
    ): Observable<T[]> {
        const dbRef = ref(this.db, `devfest${environment.year}/${type}`);
        const queryRef = queryConstraints ? query(dbRef, ...queryConstraints) : dbRef;

        return listVal<T>(queryRef, { keyField: '$key' });
    }

    modifiableList<T>(
        type: 'schedule' | 'speakers' | 'feedback' | 'volunteers',
        queryConstraints?: any[]
    ): DatabaseReference {
        const dbRef = ref(this.db, `devfest${environment.year}/${type}`);
        return queryConstraints
            ? (query(dbRef, ...queryConstraints) as unknown as DatabaseReference)
            : dbRef;
    }
}
