import { of as observableOf, Observable } from 'rxjs';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { switchMap, map } from 'rxjs/operators';
import { DataService, Speaker } from '../shared/data.service';
import { UploaderComponent } from './sffb/uploader.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './speaker-edit.component.html',
    imports: [
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        MatCheckboxModule,
        MatButtonModule,
        UploaderComponent,
        AsyncPipe,
    ],
})
export class SpeakerEditComponent {
    ds = inject(DataService);
    route = inject(ActivatedRoute);
    router = inject(Router);
    environment = environment;

    speakerData: Observable<Speaker>;

    constructor() {
        const ds = this.ds;
        const route = this.route;

        this.speakerData = route.params.pipe(
            switchMap((params) => {
                if (params['id'] === 'new') {
                    return observableOf({});
                }
                return ds
                    .getSpeakers(environment.year)
                    .pipe(map((list) => list.find((item) => item.$key === params['id'])));
            })
        );
    }

    save(speaker) {
        console.log('Saving speaker', speaker);
        event.preventDefault();
        this.ds.save('speakers', speaker);
        console.log('rerouting to', environment.year);
        this.router.navigate(['/', 'speakers']);
    }

    delete(speaker) {
        if (confirm('Are you sure you want to delete this speaker?')) {
            this.ds.delete('speakers', speaker);
            this.router.navigate(['/', 'speakers']);
        }
    }
}
