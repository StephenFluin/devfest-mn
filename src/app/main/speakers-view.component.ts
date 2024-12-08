import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DataService } from '../shared/data.service';

import { switchMap, map } from 'rxjs/operators';

import { YearService } from '../year.service';
import { AsyncPipe } from '@angular/common';
import { SpeakerFullComponent } from './speaker-full.component';

@Component({
    template: `
    <section>
            <speaker-full [speaker]="speaker | async" [year]="yearService.year"></speaker-full>
    </section>
    `,
    imports: [SpeakerFullComponent, AsyncPipe]
})
export class SpeakersViewComponent {
    yearService = inject(YearService);

    speaker;
    speakerId;
    year;

    constructor() {
        const route = inject(ActivatedRoute);
        const ds = inject(DataService);


        this.speaker = route.params.pipe(switchMap(params => {
            return ds.getSpeakers(this.yearService.year).pipe(map(list => list.find(item => item.$key === params['id'])));
        }));
    }

}
