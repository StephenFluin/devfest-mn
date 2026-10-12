import { Component, computed, effect, inject, RESPONSE_INIT } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { DataService } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { SpeakerFullComponent } from './speaker-full.component';
import { environment } from '../../environments/environment';

@Component({
    template: `
        <section>
            @if (notFound()) {
                <h2>Speaker not found</h2>
                <p>
                    This speaker isn't part of DevFestMN {{ environment.year }}. They may have
                    spoken at a <a routerLink="/past">past DevFestMN</a>.
                </p>
            } @else {
                <speaker-full [speaker]="speaker()" [year]="environment.year"></speaker-full>
            }
        </section>
    `,
    imports: [SpeakerFullComponent, RouterLink],
})
export class SpeakersViewComponent {
    environment = environment;
    private ds = inject(DataService);
    private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

    speaker = computed(() =>
        this.ds.speakers().find((item) => item.$key === this.params().get('id'))
    );

    /** Old or mistyped links answer 404 so search engines drop them instead of indexing an empty page. */
    notFound = computed(() => this.ds.speakers.loaded() && !this.speaker());

    constructor() {
        const meta = inject(OurMeta);
        const response = inject(RESPONSE_INIT, { optional: true });
        effect(() => {
            if (this.notFound()) {
                meta.setTitle('Speaker not found');
                if (response) {
                    response.status = 404;
                }
            }
        });
    }
}
