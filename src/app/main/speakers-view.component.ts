import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DataService } from '../shared/data.service';

import { switchMap, map } from 'rxjs/operators';

import { AsyncPipe } from '@angular/common';
import { SpeakerFullComponent } from './speaker-full.component';
import { environment } from '../../environments/environment';

@Component({
    template: `
        <section>
            <speaker-full [speaker]="speaker | async" [year]="environment.year"></speaker-full>
        </section>
    `,
    imports: [SpeakerFullComponent, AsyncPipe],
})
export class SpeakersViewComponent {
    speaker;
    speakerId;
    year;

    constructor() {
        const route = inject(ActivatedRoute);
        const ds = inject(DataService);

        this.speaker = route.params.pipe(
            switchMap((params) => {
                return ds
                    .getSpeakers(environment.year)
                    .pipe(map((list) => list.find((item) => item.$key === params['id'])));
            })
        );
    }
}
