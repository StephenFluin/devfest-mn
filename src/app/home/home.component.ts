import { Component } from '@angular/core';

import { environment } from '../../environments/environment';
import { YearService } from '../year.service';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

@Component({
    templateUrl: './home.component.html',
    imports: [RouterLink, ADirective]
})
export class HomeComponent {
    environment = environment;
    faqSelection = 1;

    setFaqSelection(question) {
        this.faqSelection = question;
    }

    constructor(yearService: YearService) {
        yearService.reset();
    }
}

export default HomeComponent;
