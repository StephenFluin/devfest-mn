import { Routes } from '@angular/router';
import { SpeakerCfpComponent } from './speaker-cfp.component';
import { SponsorsComponent } from './sponsors.component';
import { CodeOfConductComponent } from './code-of-conduct/code-of-conduct.component';

export const ContentRoutes: Routes = [
    { path: 'sponsors', component: SponsorsComponent, data: { title: 'Sponsors' } },
    {
        path: 'speaker-cfp',
        component: SpeakerCfpComponent,
        data: { title: 'Speaker Call for Papers', depth: 1 },
    },
    {
        path: 'conduct',
        component: CodeOfConductComponent,
        data: { title: 'Code of Conduct' },
    },
];
export default ContentRoutes;
