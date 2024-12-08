import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { YearService } from '../year.service';

@Component({
    selector: 'app-year-switcher',
    template: '<router-outlet>',
    standalone: true,
    imports: [RouterOutlet],
})
export class YearSwitcherComponent {
    constructor() {
        const route = inject(ActivatedRoute);
        const yearService = inject(YearService);

        if (route.snapshot.url.length > 0 && route.snapshot.url[0].path.match(/\d{4}/)) {
            yearService.setYear(route.snapshot.url[0].path);
        }
    }
}
