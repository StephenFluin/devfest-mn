import { Component, inject } from '@angular/core';
import { map } from 'rxjs/operators';

import { DataService } from '../shared/data.service';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    template: `
        <h2>Manage Volunteers</h2>
        <div>
            Add volunteer with ID: <input [(ngModel)]="id" /><button
                type="button"
                (click)="set(id, true)"
            >
                Add
            </button>
        </div>

        @for (volunteer of volunteerList | async; track volunteer) {
        <div>{{ volunteer }} (<a href="#" (click)="set(volunteer, null)">x</a>)</div>
        }
    `,
    imports: [FormsModule, AsyncPipe],
})
export class VolunteersComponent {
    ds = inject(DataService);
    volunteers = this.ds.getVolunteers();
    volunteerList = this.volunteers.valueChanges().pipe(
        map((map: any) => {
            if (!map) return [];
            let list = Object.keys(map);
            list = list.filter((x) => x != '$key' && x != '$exists');
            return list;
        })
    );
    id = '';
    constructor() {}

    set(volunteerId, state) {
        event.preventDefault();
        if (volunteerId) {
            let v = {};
            v[volunteerId] = state;
            this.volunteers.update(v);
        }
        this.id = '';
    }
}
