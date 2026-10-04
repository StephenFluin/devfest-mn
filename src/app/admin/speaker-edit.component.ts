import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { DataService, Speaker } from '../shared/data.service';
import { UploaderComponent } from './sffb/uploader.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    ],
})
export class SpeakerEditComponent {
    ds = inject(DataService);
    route = inject(ActivatedRoute);
    router = inject(Router);
    environment = environment;

    private params = toSignal(this.route.paramMap, { requireSync: true });

    /** A copy, so form edits don't leak into the shared live data before saving. */
    speakerData = computed<Speaker>(() => {
        const params = this.params();
        if (params.get('id') === 'new') {
            return {};
        }
        const item = this.ds.speakers().find((item) => item.$key === params.get('id'));
        return item && { ...item };
    });

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
