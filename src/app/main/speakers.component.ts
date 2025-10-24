import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';

@Component({
    templateUrl: './speakers.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, SpeakerContainerComponent, AsyncPipe],
})
export class SpeakersComponent {
    ds = inject(DataService);
    router = inject(Router);
    auth = inject(AuthService);

    speakers = this.ds.getSpeakers(environment.year);

    thisSpeaker = {};
    showDialog = false;

    year: string;

    constructor() {}

    addSpeaker() {
        this.router.navigate(['/', 'admin', 'speakers', 'new', 'edit']);
    }
}
