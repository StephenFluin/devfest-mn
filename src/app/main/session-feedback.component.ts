import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap, map } from 'rxjs/operators';

import { DataService } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { AsyncPipe } from '@angular/common';
import { UserFeedbackComponent } from './user-feedback.component';
import { environment } from '../../environments/environment';

@Component({
    template: `
        <section>
            <div class="callout">{{ $any(session | async)?.title }}</div>
            <user-feedback [session]="session | async"></user-feedback>
        </section>
    `,
    imports: [UserFeedbackComponent, AsyncPipe],
})
export class SessionFeedbackComponent {
    ds = inject(DataService);
    meta = inject(OurMeta);

    session;

    constructor() {
        const route = inject(ActivatedRoute);
        const ds = this.ds;
        const meta = this.meta;

        this.session = route.params.pipe(
            switchMap((params) => {
                return ds
                    .getSchedule(environment.year)
                    .pipe(map((list) => list.find((item) => item.$key === params['id'])));
            })
        );

        this.session.subscribe((sessionData) => {
            meta.setTitle('Feedback on ' + sessionData.title);
        });
    }
}
