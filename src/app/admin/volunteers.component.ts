import { Component, computed, inject } from '@angular/core';

import { update } from 'firebase/database';
import { DataService } from '../shared/data.service';
import { objectResource } from '../realtime-data/firebase';
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

        @for (volunteer of volunteerList(); track volunteer) {
        <div>{{ volunteer }} (<a href="#" (click)="set(volunteer, null)">x</a>)</div>
        }
    `,
    imports: [FormsModule],
})
export class VolunteersComponent {
    ds = inject(DataService);
    private volunteers = objectResource<Record<string, boolean>>(() => this.ds.ref('volunteers'), {
        initialValue: {},
    });
    volunteerList = computed(() => Object.keys(this.volunteers()));
    id = '';
    constructor() {}

    set(volunteerId, state) {
        event.preventDefault();
        if (volunteerId) {
            let v = {};
            v[volunteerId] = state;
            update(this.ds.ref('volunteers'), v);
        }
        this.id = '';
    }
}
