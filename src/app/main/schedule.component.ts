import { Component, effect, inject, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

import { DataService } from '../shared/data.service';

import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { ScheduleGridComponent } from './schedule-grid.component';
import { AsyncPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LdJsonService } from '../ld-json.service';

export interface Schedule {
    startTimes: any[];
    gridData: any;
    rooms: any[];
}

@Component({
    templateUrl: './schedule.component.html',
    imports: [ScheduleGridComponent, MatButtonModule, AsyncPipe],
})
export class ScheduleComponent {
    ds = inject(DataService);
    route = inject(ActivatedRoute);
    authService = inject(AuthService);
    ldJsonService = inject(LdJsonService);
    router = inject(Router);

    // Three versions of the same data, one raw, one processed and one filtered, one not
    sessions = this.ds.getSchedule(environment.year);
    sessionSignal = toSignal(this.sessions);
    allSessions: Observable<Schedule>;
    populatedAgenda: Observable<any>;

    // Where we store the reference to the currently selected data.
    filteredData: Observable<any>;

    constructor() {
        /**
         * Session data should look like data[time][room] = session;
         */
        this.allSessions = this.sessions.pipe(
            map((list) => {
                let data = {};
                for (let session of list) {
                    let time = session.startTime;
                    if (typeof data[time] !== 'object') {
                        data[time] = {};
                    }

                    // Get height of box
                    if (!session.blocks) {
                        session.blocks = 1;
                    }
                    if (session.track !== 'all' && session.track !== 'Keynote') {
                        data[time][session.room] = session;
                    } else {
                        data[time]['all'] = session;
                    }
                }

                let pad = (n) => (n < 10 ? '0' + n : n);
                // Look for holes
                for (let time in data) {
                    if (data.hasOwnProperty(time)) {
                        let slot = data[time];
                        // Holes can only exist if there isn't an "all" session
                        if (!slot.all) {
                            for (let room of this.ds.getVenueLayout().rooms) {
                                if (!slot[room]) {
                                    // Found a hole in this room, checking previous time slot
                                    let previous =
                                        time.substr(0, 11) +
                                        pad(parseInt(time.substr(11, 2), 10) - 1) +
                                        time.substr(13);

                                    if (!data[previous]) {
                                        // This is fine, it just means we're probably at the beginning of a day
                                        continue;
                                    }

                                    // Placeholder if there's nothing in the previous time slot, or there is and it's a short one
                                    if (!data[previous][room]) {
                                        data[time][room] = 'placeholder';
                                    } else if (
                                        !data[previous][room].blocks ||
                                        data[previous][room].blocks < 2
                                    ) {
                                        // This room has nothing in it!
                                        data[time][room] = 'placeholder';
                                    } else {
                                    }
                                }
                            }
                        }
                    }
                }

                let startTimes = Object.keys(data).sort();
                return {
                    startTimes: startTimes,
                    gridData: data,
                    rooms: this.ds.getVenueLayout().rooms,
                };
            }),
            startWith({ startTimes: [], gridData: {}, rooms: [] } as Schedule),
            shareReplay(1)
        );

        this.filteredData = this.allSessions;

        // Intersect the user's agenda against the session list if user is authed
        if (this.authService) {
            this.populatedAgenda = combineLatest([
                this.allSessions,
                toObservable(this.authService.agenda),
            ]).pipe(
                map(([allData, rawAgenda]) => {
                    return this.filterToMyAgenda(allData, rawAgenda);
                }),
                startWith({ startTimes: [], gridData: {}, rooms: [] } as Schedule)
            );
        } else {
            this.populatedAgenda = this.allSessions;
        }
        const agendaMetadata = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'DevFestMN 2025 Full Conference Schedule',
            itemListElement: [],
        };
        effect(
            () => {
                const sessionList = this.sessionSignal();

                if (!sessionList || sessionList.length <= 0) return;
                sessionList.sort((a, b) => {
                    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                });
                for (let session of sessionList) {
                    // Process each session into a ListItem and attach to itemListElement
                    agendaMetadata.itemListElement.push({
                        '@type': 'ListItem',
                        position: agendaMetadata.itemListElement.length + 1,
                        item: {
                            '@type': 'PublicationEvent',
                            name: session.title,
                            description: session.description,
                            startDate: session.startTime,
                            location: {
                                '@type': 'Place',
                                name: session.room,
                            },
                            performer: {
                                '@type': 'Person',
                                name: session.speakers
                                    ? Array.isArray(session.speakers)
                                        ? session.speakers.map((s) => s.name).join(', ')
                                        : Object.values(session.speakers)
                                              .map((s: any) => s.name)
                                              .join(', ')
                                    : 'TBA',
                            },
                            mainEntityOfPage: 'https://devfestmn.com/',
                        },
                    });
                }
                this.ldJsonService.setLdJson(agendaMetadata);
            },
            { allowSignalWrites: true }
        );
    }

    /**
     * Take in a full schedule and a set of agenda keys, return a new schedule of just those sessions the user has selected.
     */
    filterToMyAgenda(allData: Schedule, rawAgenda: any[]): Schedule {
        let result: Schedule = { startTimes: allData.startTimes, gridData: {}, rooms: [] };

        let resultSessions = {};
        let allSessions = allData.gridData;
        let rooms = [];
        let myAgendaKeys = [];

        for (let session of rawAgenda) {
            myAgendaKeys.push(session.key);
        }

        for (let time in allSessions) {
            if (allSessions.hasOwnProperty(time)) {
                resultSessions[time] = {};

                let slot = allSessions[time];
                if (!slot.all) {
                    for (let room in slot) {
                        if (slot.hasOwnProperty(room)) {
                            let session = slot[room];
                            if (myAgendaKeys.indexOf(session.$key) !== -1) {
                                // Track which rooms we actually need.
                                if (!(room in rooms)) {
                                    rooms.push(room);
                                }
                                resultSessions[time][room] = session;
                            }
                        }
                    }
                } else {
                    // Ignore user preferences for "all" sessions
                    resultSessions[time].all = slot.all;
                }
            }
        }

        // We do this to maintain the original order of the rooms
        let returnRooms = [];
        for (let room of this.ds.getVenueLayout().rooms) {
            if (rooms.indexOf(room) !== -1) {
                returnRooms.push(room);
            }
        }
        result.gridData = resultSessions;
        result.rooms = returnRooms;
        return result;
    }

    addSession() {
        this.router.navigate(['/', 'admin', 'sessions', 'new', 'edit']);
    }
}
