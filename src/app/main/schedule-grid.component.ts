import { Component, inject, input } from '@angular/core';
import { DataService } from '../shared/data.service';
import { ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { EncodeURI } from '../shared/encode-uri.pipe';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AsyncPipe, JsonPipe, KeyValuePipe } from '@angular/common';

@Component({
    selector: 'schedule-grid',
    templateUrl: 'schedule-grid.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    RouterLink,
    MatButtonModule,
    AsyncPipe,
    JsonPipe,
    KeyValuePipe,
    EncodeURI,
    GetSpeakerPipe
]
})
export class ScheduleGridComponent {
    ds = inject(DataService);
    auth = inject(AuthService);

    readonly data = input(undefined);
    readonly forceMobile = input<boolean>(undefined);
}
