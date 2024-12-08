import { Component } from '@angular/core';
import { of as observableOf } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgFor, AsyncPipe } from '@angular/common';

@Component({
    templateUrl: 'events.component.html',
    imports: [
        NgFor,
        FormsModule,
        AsyncPipe,
    ]
})
export class EventsComponent {
    events = observableOf([]);
}
