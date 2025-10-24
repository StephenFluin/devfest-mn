import { Component, DOCUMENT, inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../environments/environment';

import { filter } from 'rxjs/operators';
import { OurMeta } from './our-meta.service';

import { ADirective } from './a.directive';
import { trackTicketPurchase } from './analytics.util';

declare global {
    interface Window {
        ga: any;
    }
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    imports: [ADirective, RouterLink, RouterOutlet],
})
export class AppComponent {
    environment = environment;
    private document = inject(DOCUMENT);
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
                let pageTitle = this.getDeepestTitle(router.routerState.snapshot.root);
                if (pageTitle && pageTitle !== true) {
                    meta.setTitle(pageTitle);
                } else if (pageTitle !== false) {
                    meta.clearTitle();
                }

                meta.clearCanonical();

                if (typeof window !== 'undefined') {
                    window.scrollTo(0, 0);
                    window.ga('send', 'pageview', n.urlAfterRedirects);
                }
            });
        router.events
            .pipe(filter((e) => e instanceof NavigationStart))
            .subscribe((n: NavigationStart) => {});
    }

    ngOnInit() {
        const link = this.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/a/montserrat-latin-400-700.woff2';
        this.document.head.appendChild(link);
    }

    prepRouteState(outlet: any) {
        return outlet.activatedRouteData['depth'] || '0';
    }

    getDeepestTitle(snapshot): string | boolean {
        let child = snapshot.children[0];
        let result;
        if (child) {
            result = this.getDeepestTitle(child);
        } else if (snapshot.data['title']) {
            result = snapshot.data['title'];
        } else {
            result = false;
        }
        return result;
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
