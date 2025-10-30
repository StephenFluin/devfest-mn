import { Component, inject } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThanksDialogComponent } from './thanks.dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { tap, switchMap, take, filter } from 'rxjs/operators';
import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
    selector: 'app-cfp',
    templateUrl: './cfp.component.html',
    imports: [
        FormsModule,
        ReactiveFormsModule,
        RouterLink,
        MatFormFieldModule,
        MatInputModule,
        MatRadioModule,
        MatButtonModule,
        AsyncPipe,
        DatePipe,
    ],
})
export class CFPComponent {
    private store = inject(AngularFirestore);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    auth = inject(AuthService);

    cfp = this.fb.group({
        name: ['', Validators.required],
        email: ['', Validators.required],
        twitter: [''],
        phone: ['', Validators.pattern('^[0-9-+_ ]{7,}$')],
        company: [''],
        technology: [''],
        type: ['', Validators.required],
        difficulty: ['', Validators.required],
        title: ['', Validators.required],
        abstract: ['', Validators.required],
        bio: ['', Validators.required],
        references: [''],
        referrer: ['', Validators.required],
    });

    priorSubmissionDate: string = null;

    constructor() {
        const auth = this.auth;

        auth.uid
            .pipe(
                tap((x) => console.log('Id was', x)),
                switchMap((uid) =>
                    this.store.doc(`years/${environment.year}/proposals/${uid}`).valueChanges()
                ),
                take(1),
                filter((x) => !!x)
            )
            .subscribe((priorSubmission) => {
                this.cfp.patchValue(priorSubmission);
                this.priorSubmissionDate = priorSubmission['date'];
            });
    }

    submit(group, uid: string) {
        if (group.valid) {
            const proposal = this.store.doc(`years/${environment.year}/proposals/${uid}`);
            proposal.set({ ...group.value, date: new Date().toISOString() });
            this.dialog.open(ThanksDialogComponent);
        }
    }
}

export default CFPComponent;
