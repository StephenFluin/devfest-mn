import { Component } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { trigger, transition, group, query, style, animate } from '@angular/animations';
import { environment } from '../environments/environment';

import { filter } from 'rxjs/operators';
import { OurMeta } from './our-meta.service';
import { NgIf } from '@angular/common';
import { ADirective } from './a.directive';

declare global {
    interface Window {
        ga: any;
    }
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    animations: [
        trigger('routeAnimation', [
            transition('1 =>2', [
                style({ height: '!' }),
                query(':enter', style({ transform: 'translateX(100%)' })),
                query(':enter, :leave', style({ position: 'absolute', top: 0, left: 0, right: 0 })),
                // animate the leave page away
                group([
                    query(':leave', [
                        animate('0.3s cubic-bezier(.35,0,.25,1)', style({ transform: 'translateX(-100%)' })),
                    ]),
                    // and now reveal the enter
                    query(':enter', animate('0.3s cubic-bezier(.35,0,.25,1)', style({ transform: 'translateX(0)' }))),
                ]),
            ]),
            transition('2 => 1', [
                style({ height: '!' }),
                query(':enter', style({ transform: 'translateX(-100%)' })),
                query(':enter, :leave', style({ position: 'absolute', top: 0, left: 0, right: 0 })),
                // animate the leave page away
                group([
                    query(':leave', [
                        animate('0.3s cubic-bezier(.35,0,.25,1)', style({ transform: 'translateX(100%)' })),
                    ]),
                    // and now reveal the enter
                    query(':enter', animate('0.3s cubic-bezier(.35,0,.25,1)', style({ transform: 'translateX(0)' }))),
                ]),
            ]),
        ]),
    ],
    imports: [ADirective, RouterLink, NgIf, RouterOutlet]
})
export class AppComponent {
    environment = environment;

    widgetReady = false;

    constructor(router: Router, meta: OurMeta) {
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
        if (this.widgetReady) {
            return;
        }
        this.lazyLoadEBWidget();
    }
    lazyLoadEBWidget() {
        return import('../eb-widget').then(() => {
            console.log('eb-widget loaded');
            console.log(window['EBWidgets']);
            var exampleCallback = function () {
                console.log('Order complete!');
            };
            window['EBWidgets'].createWidget({
                widgetType: 'checkout',
                eventId: '1082249821349',
                modal: true,
                modalTriggerElementId: 'global-ticket-button',
                onOrderComplete: exampleCallback,
            });
            this.widgetReady = true;
        });
    }
    /*
     * Let the user click before the widget is loaded, then click it for them
     */
    lazyClickEBWidget() {
        if (!this.widgetReady) {
            this.lazyLoadEBWidget().then(() => {
                document.getElementById('global-ticket-button').click();
            });
        }
    }
}
