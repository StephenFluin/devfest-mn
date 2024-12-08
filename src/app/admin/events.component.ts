import { Component } from '@angular/core';
import { of as observableOf } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';

@Component({
    templateUrl: 'events.component.html',
    imports: [
    FormsModule,
    AsyncPipe
]
})
export class EventsComponent {
    events = observableOf([]);
}
