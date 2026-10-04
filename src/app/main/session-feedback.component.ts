import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { DataService } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { UserFeedbackComponent } from './user-feedback.component';

@Component({
    template: `
        <section>
            <div class="callout">{{ session()?.title }}</div>
            <user-feedback [session]="session()"></user-feedback>
        </section>
    `,
    imports: [UserFeedbackComponent],
})
export class SessionFeedbackComponent {
    private ds = inject(DataService);
    private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

    session = computed(() => this.ds.schedule().find((item) => item.$key === this.params().get('id')));

    constructor() {
        const meta = inject(OurMeta);
        effect(() => {
            const title = this.session()?.title;
            if (title) {
                meta.setTitle('Feedback on ' + title);
            }
        });
    }
}
