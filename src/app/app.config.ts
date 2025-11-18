import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import {
    BrowserModule,
    provideClientHydration,
    withIncrementalHydration,
} from '@angular/platform-browser';
import { UrlSegment, provideRouter } from '@angular/router';
import MainRoutes from './app.routes';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
    providers: [
        importProvidersFrom(BrowserModule, MatSnackBarModule),
        provideRouter(MainRoutes),
        provideClientHydration(withIncrementalHydration()),
        provideZonelessChangeDetection(),
        provideHttpClient(),
    ],
};
