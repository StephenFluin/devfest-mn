import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { MatButtonModule } from '@angular/material/button';

@Component({
    templateUrl: './speakers.component.html',

    imports: [MatButtonModule, SpeakerContainerComponent],
})
export class SpeakersComponent {
    ds = inject(DataService);
    router = inject(Router);
    auth = inject(AuthService);

    speakers = this.ds.speakers;

    thisSpeaker = {};
    showDialog = false;

    year: string;

    constructor() {}

    addSpeaker() {
        this.router.navigate(['/', 'admin', 'speakers', 'new', 'edit']);
    }
}
