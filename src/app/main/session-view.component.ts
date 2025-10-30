import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import snarkdown from 'snarkdown';

import { DataService, Session } from '../shared/data.service';
import { DomSanitizer } from '@angular/platform-browser';
import { OurMeta } from '../our-meta.service';
import { AsyncPipe } from '@angular/common';
import { SessionDetailsComponent } from './session-details.component';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './session-view.component.html',
    imports: [SessionDetailsComponent, AsyncPipe],
})
export class SessionViewComponent {
    session: Observable<Session>;

    constructor() {
        const route = inject(ActivatedRoute);
        const ds = inject(DataService);
        const meta = inject(OurMeta);
        const sanitizer = inject(DomSanitizer);

        this.session = route.params.pipe(
            switchMap((params) =>
                ds.getSchedule(environment.year).pipe(
                    map((list) => list.find((item) => item.$key === params['id'])),
                    map((item) => {
                        if (!item) {
                            return {};
                        }
                        item.renderedDescription = sanitizer.bypassSecurityTrustHtml(
                            snarkdown(item.description || '')
                        );
                        return item;
                    })
                )
            )
        );

        this.session.subscribe((sessionData) => {
            if (sessionData) {
                console.log('setting session view metadata');
                meta.setTitle(sessionData.title);
            }
        });
    }
}
