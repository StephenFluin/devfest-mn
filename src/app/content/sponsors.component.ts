import { Component } from '@angular/core';
import { ADirective } from '../a.directive';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './sponsor.component.html',
    imports: [ADirective]
})
export class SponsorsComponent  {
    environment = environment;
    sponsorMailto = `mailto:${environment.contactEmail}?subject=Sponsor%20DevFestMN`;

}
