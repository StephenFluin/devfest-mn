import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
    templateUrl: 'events.component.html',
    imports: [FormsModule],
})
export class EventsComponent {
    events = signal<{ id?: string; title?: string }[]>([]);
}
