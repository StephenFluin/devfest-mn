import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  mergeApplicationConfig,
} from '@angular/core';
import { breadcrumbs, getCrashlytics, recordError } from 'firebase/crashlytics';
import { CrashlyticsOptions, provideCrashlytics } from 'firebase/crashlytics/angular';

import { appConfig } from './app.config';
import { FIREBASE_APP } from './realtime-data/firebase';

/**
 * Crashlytics must get the same options everywhere it's set up for an app. Breadcrumbs record the
 * route changes, clicks, network requests and page visibility leading up to an error.
 */
const crashlyticsOptions: CrashlyticsOptions = { features: [breadcrumbs()] };

/**
 * Reports uncaught errors to Crashlytics and still logs them to the console, as Angular's own
 * handler does. (Crashlytics' handler only reports them.)
 */
class ReportingErrorHandler extends ErrorHandler {
  private crashlytics = getCrashlytics(inject(FIREBASE_APP), crashlyticsOptions);

  override handleError(error: unknown) {
    super.handleError(error);
    recordError(this.crashlytics, error);
  }
}

/**
 * The app as it runs in the browser. Crashlytics is left out of server rendering, and of `ng serve`
 * so local development doesn't report errors.
 */
export const browserConfig: ApplicationConfig = isDevMode()
  ? appConfig
  : mergeApplicationConfig(appConfig, {
      providers: [
        // Uncaught errors, route changes as parameterized paths (e.g. /speakers/:id/:slug) and
        // breadcrumbs.
        provideCrashlytics(() => inject(FIREBASE_APP), crashlyticsOptions),
        { provide: ErrorHandler, useClass: ReportingErrorHandler },
      ],
    });
