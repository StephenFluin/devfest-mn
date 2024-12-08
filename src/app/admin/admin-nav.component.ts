import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';

import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';

@Component({
    selector: 'admin-nav',
    template: `
    <mat-tab-group  (focusChange)="select($event)">
      <mat-tab label="Feedback">
      </mat-tab>
      <mat-tab label="Volunteers">
      </mat-tab>

    </mat-tab-group>
  `,
    imports: [MatTabsModule]
})
export class AdminNavComponent {
  router = inject(Router);


  select(event: MatTabChangeEvent) {
    if(event.index === 0) {
      this.router.navigate(['admin', 'reports']);
    } else if(event.index === 1) {
        this.router.navigate(['admin', 'volunteers']);
    } else {
    }

  }

}
