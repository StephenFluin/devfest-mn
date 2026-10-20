import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TextFieldModule } from '@angular/cdk/text-field';

import { DataService, Speaker } from '../shared/data.service';
import { UploaderComponent } from './sffb/uploader.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { environment } from '../../environments/environment';
import { slugify } from '../shared/slug';

@Component({
    templateUrl: './speaker-edit.component.html',
    styles: `
        .profile {
            display: grid;
            grid-template-columns: 160px 1fr;
            gap: 24px;
            align-items: start;
        }
        @media (max-width: 640px) {
            .profile {
                grid-template-columns: 1fr;
            }
        }
        .photo img,
        .avatar.big {
            width: 160px;
            height: 160px;
            border-radius: 50%;
            object-fit: cover;
            font: var(--mat-sys-display-medium);
        }
        .share {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin: 8px 0 0;
        }
    `,
    imports: [
        RouterLink,
        TextFieldModule,
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
    slugify = slugify;

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

    save(speaker: Speaker, event: Event) {
        event.preventDefault();
        this.ds.save('speakers', speaker);
        this.router.navigate(['/', 'speakers']);
    }

    delete(speaker) {
        if (confirm(`Delete ${speaker.name || 'this speaker'}? This can't be undone.`)) {
            this.ds.delete('speakers', speaker);
            this.router.navigate(['/', 'speakers']);
        }
    }
}
