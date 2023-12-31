import { of as observableOf, Observable } from 'rxjs';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { switchMap, map } from 'rxjs/operators';
import { DataService, Speaker } from '../shared/data.service';
import { YearService } from '../year.service';
import { UploaderComponent } from './sffb/uploader.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
    templateUrl: './speaker-edit.component.html',
    standalone: true,
    imports: [
        NgIf,
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
    speakerData: Observable<Speaker>;

    constructor(
        public ds: DataService,
        public route: ActivatedRoute,
        public router: Router,
        public yearService: YearService
    ) {
        this.speakerData = route.params.pipe(
            switchMap((params) => {
                if (params['id'] === 'new') {
                    return observableOf({});
                }
                return ds
                    .getSpeakers(this.yearService.year)
                    .pipe(map((list) => list.find((item) => item.$key === params['id'])));
            })
        );
    }

    save(speaker) {
        console.log('Saving speaker', speaker);
        event.preventDefault();
        this.ds.save('speakers', speaker);
        console.log('rerouting to', this.yearService.year);
        this.router.navigate(['/', 'speakers']);
    }

    delete(speaker) {
        if (confirm('Are you sure you want to delete this speaker?')) {
            this.ds.delete('speakers', speaker);
            this.router.navigate(['/', 'speakers']);
        }
    }
}
