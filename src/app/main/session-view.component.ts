import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import snarkdown from 'snarkdown';
import { slugify, summarize } from '../shared/slug';

import { DataService, Session } from '../shared/data.service';
import { DomSanitizer } from '@angular/platform-browser';
import { OurMeta } from '../our-meta.service';
import { SessionDetailsComponent } from './session-details.component';

@Component({
    templateUrl: './session-view.component.html',
    imports: [SessionDetailsComponent],
})
export class SessionViewComponent {
    private ds = inject(DataService);
    private sanitizer = inject(DomSanitizer);
    private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

    session = computed<Session | undefined>(() => {
        const item = this.ds.schedule().find((s) => s.$key === this.params().get('id'));
        if (!item) {
            return undefined;
        }
        return {
            ...item,
            renderedDescription: this.sanitizer.bypassSecurityTrustHtml(
                snarkdown(item.description || '')
            ),
        };
    });

    constructor() {
        const meta = inject(OurMeta);
        effect(() => {
            const session = this.session();
            if (session?.title) {
                meta.setTitle(session.title);
                meta.setCanonical(`schedule/${session.$key}/${slugify(session.title)}`);
                if (session.description) {
                    meta.setDescription(summarize(session.description));
                }
            }
        });
    }
}
