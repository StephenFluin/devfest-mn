import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { appConfig } from './app/app.config';

if (!environment.production) {
    console.log('Using DEV environment configuration');
}

bootstrapApplication(AppComponent, appConfig);
