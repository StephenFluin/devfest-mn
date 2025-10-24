import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataService } from '../shared/data.service';

import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { AsyncPipe } from '@angular/common';

export interface Schedule {
    startTimes: any[];
    gridData: any;
    rooms: any[];
}

@Component({
    templateUrl: './sessions.component.html',
    imports: [RouterLink, AsyncPipe],
})
export class SessionsComponent {
    ds = inject(DataService);
    router = inject(Router);
    auth = inject(AuthService);

    sessions = this.ds.getSchedule(environment.year);

    thisSession = {};
    showDialog = false;

    constructor() {}
}
