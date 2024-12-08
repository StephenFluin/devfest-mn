import { Injectable, inject } from '@angular/core';
import {
    AngularFireDatabase,
    AngularFireList,
    AngularFireObject,
    QueryFn,
} from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { SafeHtml } from '@angular/platform-browser';
import { YearService } from '../year.service';
import { localstorageCache } from './localstorage-cache.operator';

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
    db = inject(AngularFireDatabase);
    yearService = inject(YearService);

    private speakersByYear: { [key: string]: Observable<Speaker[]> } = {};
    private scheduleByYear: { [key: string]: Observable<Session[]> } = {};

    getSpeakers(year: string) {
        if (this.speakersByYear[year]) {
            return this.speakersByYear[year];
        }

        this.speakersByYear[year] = this.listPath('speakers', (ref) =>
            ref.orderByChild('name')
        ).pipe(
            filter((x) => !!x),
            localstorageCache('speakerCache' + year)
        );
        return this.speakersByYear[year];
    }
    getSpeaker(speakerKey: string) {
        return this.db
            .object<Speaker>(`devfest${this.yearService.year}/speakers/${speakerKey}/name`)
            .valueChanges();
    }

    getSchedule(year: string): Observable<Session[]> {
        if (this.scheduleByYear[year]) {
            return this.scheduleByYear[year];
        }
        this.scheduleByYear[year] = this.listPath<Session>('schedule', (ref) =>
            ref.orderByChild('title')
        ).pipe(
            filter((x) => !!x),
            localstorageCache('sessionsCache' + year)
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
        return this.listPath('feedback');
    }
    getVolunteers() {
        return this.db.object(`devfest${this.yearService.year}/volunteers`);
    }

    getAgenda(uid: string, session: string): AngularFireObject<any> {
        const path = `devfest${this.yearService.year}/agendas/${uid}/${session}/`;
        console.log('fetching agenda stored at', path);
        return this.db.object(path);
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
        let list = this.modifiableList(path);
        let result;
        if (item.$key) {
            let key = item.$key;
            delete item.$key;
            result = list.update(key, item);
            item.$key = key;
        } else {
            result = list.push(item);
        }
        return result;
    }

    delete(path: 'schedule' | 'speakers', item) {
        console.log('Attempting to delete', item, 'of type', path);
        let list = this.modifiableList(path);
        list.remove(item.$key);
    }

    deleteSpeakerFromSession(session: Session, speakerKey: string) {
        const list = this.db.list(
            `devfest${this.yearService.year}/schedule/${session.$key}/speakers`
        );
        list.remove(speakerKey)
            .then(() => {
                console.log(`Speaker (${speakerKey} deleted from session (${session.$key}) .`);
            })
            .catch((err) => {
                console.error('Error deleting speaker from session', err);
            });
    }

    listPath<T>(
        type: 'schedule' | 'speakers' | 'feedback' | 'volunteers',
        query?: QueryFn
    ): Observable<T[]> {
        return this.modifiableList<T>(type, query)
            .snapshotChanges()
            .pipe(
                map((actions) =>
                    actions.map((action) => {
                        let value = action.payload.val();
                        value['$key'] = action.key;
                        return value;
                    })
                )
            );
    }

    modifiableList<T>(
        type: 'schedule' | 'speakers' | 'feedback' | 'volunteers',
        query?: QueryFn
    ): AngularFireList<T> {
        return this.db.list<T>(`devfest${this.yearService.year}/${type}`, query);
    }
}
