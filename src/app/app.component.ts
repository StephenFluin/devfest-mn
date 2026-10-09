import { Component, inject, PLATFORM_ID } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    Data,
    NavigationEnd,
    Router,
    RouterLink,
    RouterOutlet,
} from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../environments/environment';

import { filter } from 'rxjs/operators';
import { OurMeta } from './our-meta.service';

import { ADirective } from './a.directive';
import { trackTicketPurchase } from './analytics.util';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    imports: [ADirective, RouterLink, RouterOutlet],
})
export class AppComponent {
    environment = environment;
    private platformId = inject(PLATFORM_ID);
    private isBrowser = isPlatformBrowser(this.platformId);
    isSecure = this.isBrowser && window?.location?.protocol === 'https:';

    widgetReady = false;

    constructor() {
        const router = inject(Router);
        const meta = inject(OurMeta);

        router.events
            .pipe(filter((e) => e instanceof NavigationEnd))
            .subscribe((n: NavigationEnd) => {
                // Defaults for every page; detail pages override these once their data loads.
                const data = this.getDeepestData(router.routerState.snapshot.root);
                if (data['title'] && data['title'] !== true) {
                    meta.setTitle(data['title']);
                } else if (data['title'] !== false) {
                    meta.clearTitle();
                }
                meta.setDescription(data['description']);
                meta.setCanonical(n.urlAfterRedirects.split(/[?#]/)[0].slice(1));

                if (typeof window !== 'undefined') {
                    // Honor in-page anchors like /#tickets; otherwise start each page at the top.
                    const fragment = n.urlAfterRedirects.split('#')[1];
                    const target = fragment && document.getElementById(fragment);
                    if (target) {
                        target.scrollIntoView();
                    } else {
                        window.scrollTo(0, 0);
                    }
                }
            });
    }

    getDeepestData(snapshot: ActivatedRouteSnapshot): Data {
        return snapshot.firstChild ? this.getDeepestData(snapshot.firstChild) : snapshot.data;
    }

    loadEBWidget() {
        if (!this.isBrowser || this.widgetReady || !this.isSecure) {
            return;
        }
        this.lazyLoadEBWidget();
    }
    lazyLoadEBWidget() {
        if (!this.isBrowser || !this.isSecure) {
            return Promise.resolve();
        }
        return import('../eb-widget').then(() => {
            console.log('eb-widget loaded');
            console.log(window['EBWidgets']);
            window['EBWidgets'].createWidget({
                widgetType: 'checkout',
                eventId: environment.eventbriteEventId,
                modal: true,
                modalTriggerElementId: 'global-ticket-button',
                onOrderComplete: trackTicketPurchase,
            });
            this.widgetReady = true;
        });
    }
    /*
     * Let the user click before the widget is loaded, then click it for them
     */
    lazyClickEBWidget() {
        if (!this.isBrowser) {
            return;
        }
        if (!this.isSecure) {
            alert('Eventbrite widget requires a secure (https) connection to load.');
            return;
        }
        if (!this.widgetReady && this.isSecure) {
            this.lazyLoadEBWidget().then(() => {
                document.getElementById('global-ticket-button')?.click();
            });
        }
    }
}
