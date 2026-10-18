import { Component, inject, input } from '@angular/core';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { slugify } from '../shared/slug';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { JsonPipe, KeyValuePipe } from '@angular/common';

@Component({
    selector: 'schedule-grid',
    templateUrl: 'schedule-grid.component.html',
    imports: [
    RouterLink,
    MatButtonModule,
    JsonPipe,
    KeyValuePipe,
    GetSpeakerPipe
]
})
export class ScheduleGridComponent {
    slugify = slugify;
    ds = inject(DataService);
    auth = inject(AuthService);

    readonly data = input(undefined);
    readonly forceMobile = input<boolean>(undefined);
}
