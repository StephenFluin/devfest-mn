import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideRouter, withRouterConfig } from '@angular/router';
import MainRoutes from './app.routes';
import { provideHttpClient, withXhr } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    // 'computed' keeps browser history intact when someone chooses to stay on a page after Back.
    provideRouter(MainRoutes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideClientHydration(withIncrementalHydration()),
    provideZonelessChangeDetection(),
    provideHttpClient(withXhr()),
  ],
};
