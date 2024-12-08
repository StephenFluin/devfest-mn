import { Routes } from '@angular/router';




export const ContentRoutes: Routes = [
    { path: 'sponsors', loadComponent: () => import('./sponsors.component').then(m => m.SponsorsComponent), data: { title: 'Sponsors' } },
    {
        path: 'speaker-cfp',
        loadComponent: () => import('./speaker-cfp.component').then(m => m.SpeakerCfpComponent),
        data: { title: 'Speaker Call for Papers', depth: 1 },
    },
    {
        path: 'conduct',
        loadComponent: () => import('./code-of-conduct/code-of-conduct.component').then(m => m.CodeOfConductComponent),
        data: { title: 'Code of Conduct' },
    },
];
export default ContentRoutes;
