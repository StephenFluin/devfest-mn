import { Component, Input } from '@angular/core';
import { Speaker } from '../shared/data.service';
import { OurMeta } from '../our-meta.service';
import { OnChanges } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { RouterLink } from '@angular/router';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
    selector: 'speaker-full',
    templateUrl: 'speaker-full.component.html',
    standalone: true,
    imports: [
        NgIf,
        RouterLink,
        AsyncPipe,
    ],
})
export class SpeakerFullComponent implements OnChanges {
    @Input()
    speaker: Speaker;
    @Input()
    year;

    constructor(public auth: AuthService, public meta: OurMeta) {}
    ngOnChanges() {
        if (this.speaker) {
            const encodedName = encodeURIComponent(this.speaker.name);
            this.meta.setTitle(this.speaker.name);
            this.meta.setCanonical(`${this.year}/speakers/${this.speaker.$key}/${encodedName}`);
        }
    }
}
