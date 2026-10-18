import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DataService, Session } from '../shared/data.service';

import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { ScheduleGridComponent } from './schedule-grid.component';
import { OurMeta } from '../our-meta.service';
import { environment } from '../../environments/environment';
import { slugify, summarize } from '../shared/slug';

export interface Schedule {
    startTimes: any[];
    gridData: any;
    rooms: any[];
}

@Component({
    templateUrl: './schedule.component.html',
    imports: [ScheduleGridComponent, MatButtonModule],
})
export class ScheduleComponent {
    ds = inject(DataService);
    authService = inject(AuthService);
    private meta = inject(OurMeta);
    router = inject(Router);

    showAgenda = signal(false);
    allSessions = computed(() => this.buildGrid(this.ds.schedule()));
    populatedAgenda = computed(() =>
        this.filterToMyAgenda(this.allSessions(), this.authService.agenda())
    );
    data = computed(() => (this.showAgenda() ? this.populatedAgenda() : this.allSessions()));

    constructor() {
        // The schedule as a list of events, each part of the conference and linked to its page.
        effect(() => {
            const sessions = [...this.ds.schedule()]
                .filter((session) => session.title)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            if (!sessions.length) return;
            const conference = {
                '@type': 'Event',
                name: `DevFestMN ${environment.year}`,
                url: environment.siteUrl,
            };
            this.meta.setStructuredData({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `DevFestMN ${environment.year} Schedule`,
                itemListElement: sessions.map((session, i) => {
                    // A session's speakers map ids to speaker keys; only confirmed speakers are public.
                    const performers = Object.values<string>(session.speakers ?? {})
                        .map((key) => this.ds.speaker(key))
                        .filter((speaker) => speaker?.confirmed && speaker.name)
                        .map((speaker) => ({
                            '@type': 'Person',
                            name: speaker.name,
                            url: `${environment.siteUrl}/speakers/${speaker.$key}/${slugify(speaker.name)}`,
                        }));
                    return {
                        '@type': 'ListItem',
                        position: i + 1,
                        item: {
                            '@type': 'Event',
                            name: session.title,
                            url: `${environment.siteUrl}/schedule/${session.$key}/${slugify(session.title)}`,
                            ...(session.description && {
                                description: summarize(session.description, 500),
                            }),
                            ...(session.startTime && { startDate: session.startTime }),
                            location: {
                                '@type': 'Place',
                                name: session.room || environment.venueName,
                                ...(session.room && {
                                    containedInPlace: {
                                        '@type': 'Place',
                                        name: environment.venueName,
                                        address: environment.venueAddress,
                                    },
                                }),
                            },
                            ...(performers.length && { performer: performers }),
                            superEvent: conference,
                        },
                    };
                }),
            });
        });
    }

    /**
     * Session data should look like data[time][room] = session;
     */
    buildGrid(list: Session[]): Schedule {
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
