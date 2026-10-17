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
import { captureAttribution, eventbriteAttribution, trackTicketPurchase } from './analytics.util';

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
        if (this.isBrowser) {
            captureAttribution();
        }

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
    private widgetLoading: Promise<void> | undefined;
    lazyLoadEBWidget() {
        if (!this.isBrowser || !this.isSecure) {
            return Promise.resolve();
        }
        // Hovering, focusing and clicking can all ask for the widget; only create it once.
        return (this.widgetLoading ??= import('../eb-widget').then(() => {
            window['EBWidgets'].createWidget({
                widgetType: 'checkout',
                eventId: environment.eventbriteEventId,
                ...eventbriteAttribution(),
                modal: true,
                modalTriggerElementId: 'global-ticket-button',
                onOrderComplete: trackTicketPurchase,
            });
            this.widgetReady = true;
        }).catch((error) => {
            this.widgetLoading = undefined;
            throw error;
        }));
    }
    /*
     * Open the checkout modal in place of following the link. The link itself goes to /tickets,
     * which still works before the app has loaded and over http, where the widget can't run.
     * If the user clicks before the widget is loaded, load it and then click it for them.
     */
    lazyClickEBWidget(event: MouseEvent) {
        const opensNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
        if (!this.isBrowser || !this.isSecure || opensNewTab) {
            return;
        }
        event.preventDefault();
        if (!this.widgetReady) {
            this.lazyLoadEBWidget().then(
                () => document.getElementById('global-ticket-button')?.click(),
                () => window.location.assign('/tickets')
            );
        }
    }
}
