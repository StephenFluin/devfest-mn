import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { YearService } from '../year.service';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { MatButtonModule } from '@angular/material/button';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';

@Component({
    templateUrl: './speakers.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, MatButtonModule, NgFor, SpeakerContainerComponent, AsyncPipe],
})
export class SpeakersComponent {
    speakers;

    thisSpeaker = {};
    showDialog = false;

    year: string;

    constructor(
        public ds: DataService,
        public router: Router,
        public auth: AuthService,
        public yearService: YearService
    ) {
        this.speakers = ds.getSpeakers(yearService.year);
    }

    addSpeaker() {
        this.router.navigate(['/', 'admin', 'speakers', 'new', 'edit']);
    }
}
