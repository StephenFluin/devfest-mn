import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ADirective } from '../a.directive';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './sponsor.component.html',
    imports: [ADirective, DatePipe]
})
export class SponsorsComponent  {
    environment = environment;

    constructor() { }

}
