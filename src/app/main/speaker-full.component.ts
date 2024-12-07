import { Component, Input, Sanitizer } from '@angular/core';
import { Speaker } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { OnChanges } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { RouterLink } from '@angular/router';
import { NgIf, AsyncPipe } from '@angular/common';
import { ADirective } from '../a.directive';
import { DomSanitizer } from '@angular/platform-browser';

import snarkdown from 'snarkdown';

@Component({
    selector: 'speaker-full',
    templateUrl: 'speaker-full.component.html',
    standalone: true,
    imports: [NgIf, RouterLink, AsyncPipe, ADirective],
})
export class SpeakerFullComponent implements OnChanges {
    @Input()
    speaker: Speaker;
    @Input()
    year;

    constructor(public auth: AuthService, public meta: OurMeta, public sanitizer: DomSanitizer) {}
    ngOnChanges() {
        if (this.speaker) {
            const encodedName = encodeURIComponent(this.speaker.name);
            this.meta.setTitle(this.speaker.name);
            this.meta.setCanonical(`${this.year}/speakers/${this.speaker.$key}/${encodedName}`);
            this.speaker.renderedBio = this.sanitizer.bypassSecurityTrustHtml(
                snarkdown(this.speaker.bio || '')
            );
        }
    }
}
