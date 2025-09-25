import { Component, inject } from '@angular/core';

import { environment } from '../../environments/environment';
import { YearService } from '../year.service';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

declare global {
    interface Window {
        EBWidgets: any;
    }
}

@Component({
    templateUrl: './home.component.html',
    imports: [RouterLink, ADirective],
})
export class HomeComponent {
    environment = environment;
    mode: 'dayof' | 'early' = 'early';
    faqSelection = 1;

    setFaqSelection(question) {
        this.faqSelection = question;
    }

    constructor() {
        const yearService = inject(YearService);

        yearService.reset();
    }

    ngAfterViewInit() {
        var exampleCallback = function () {
            console.log('Order complete!');
        };

        window.EBWidgets.createWidget({
            // Required
            widgetType: 'checkout',
            eventId: environment.eventbriteEventId,
            iframeContainerId: 'eventbrite-widget-container-1684295616529',

            // Optional
            iframeContainerHeight: 425, // Widget height in pixels. Defaults to a minimum of 425px if not provided
            onOrderComplete: exampleCallback, // Method called when an order has successfully completed
        });
        console.log('Created widget');
    }
}

export default HomeComponent;
