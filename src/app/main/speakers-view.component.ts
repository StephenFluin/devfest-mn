import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { DataService } from '../shared/data.service';
import { SpeakerFullComponent } from './speaker-full.component';
import { environment } from '../../environments/environment';

@Component({
    template: `
        <section>
            <speaker-full [speaker]="speaker()" [year]="environment.year"></speaker-full>
        </section>
    `,
    imports: [SpeakerFullComponent],
})
export class SpeakersViewComponent {
    environment = environment;
    private ds = inject(DataService);
    private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

    speaker = computed(() =>
        this.ds.speakers().find((item) => item.$key === this.params().get('id'))
    );
}
