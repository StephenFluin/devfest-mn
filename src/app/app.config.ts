import { ApplicationConfig } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import {
    BrowserModule,
    provideClientHydration,
    withIncrementalHydration,
} from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { UrlSegment, provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
    providers: [
        importProvidersFrom(BrowserModule, MatSnackBarModule),
        provideAnimations(),
        provideRouter([
            {
                path: '',
                pathMatch: 'full',
                loadComponent: () => import('./home/home.component'),
            },
            {
                matcher: isMarketingContent,
                loadChildren: () => import('./content/content.routes'),
            },
            {
                path: '',
                loadChildren: () => import('./authenticated/authenticated.routes'),
            },
        ]),
        provideClientHydration(withIncrementalHydration()),
    ],
};

export function isMarketingContent(url: UrlSegment[]) {
    let result =
        url.length === 1 && url[0].path.match(/(tickets|sponsors|past|speaker-cfp|conduct)/)
            ? { consumed: [] }
            : null;
    return result;
}
