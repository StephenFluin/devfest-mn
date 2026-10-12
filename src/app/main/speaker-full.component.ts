import { Component, Sanitizer, inject, input } from '@angular/core';
import { Speaker } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { OnChanges } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ADirective } from '../a.directive';
import { DomSanitizer } from '@angular/platform-browser';

import snarkdown from 'snarkdown';

@Component({
    selector: 'speaker-full',
    templateUrl: 'speaker-full.component.html',
    imports: [RouterLink, AsyncPipe, ADirective]
})
export class SpeakerFullComponent implements OnChanges {
    auth = inject(AuthService);
    meta = inject(OurMeta);
    sanitizer = inject(DomSanitizer);

    readonly speaker = input<Speaker>(undefined);
    readonly year = input(undefined);
    ngOnChanges() {
        const speaker = this.speaker();
        if (speaker) {
            const seoName = speaker.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            this.meta.setTitle(speaker.name);
            this.meta.setCanonical(`speakers/${speaker.$key}/${seoName}`);
            speaker.renderedBio = this.sanitizer.bypassSecurityTrustHtml(
                snarkdown(speaker.bio || '')
            );
        }
    }
}
