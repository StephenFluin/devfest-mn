import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import MainRoutes from './app.routes';
import { provideHttpClient, withXhr } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(MainRoutes),
        provideClientHydration(withIncrementalHydration()),
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr()),
    ],
};
