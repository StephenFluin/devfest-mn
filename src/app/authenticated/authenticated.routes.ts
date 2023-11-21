import { Routes } from '@angular/router';
import HomeComponent from '../home/home.component';
import { DataService } from '../shared/data.service';
import { importProvidersFrom } from '@angular/core';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { FirebaseService } from '../realtime-data/firebase.service';

export const AuthenticatedRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        providers: [
            DataService,
            importProvidersFrom(
                AngularFireModule.initializeApp(environment.firebaseConfig),
                AngularFireAuthModule,
                AngularFireDatabaseModule
            ),
            AuthService,
            FirebaseService,
        ],
        children: [
            { path: 'test', component: HomeComponent },
            {
                path: 'admin',
                loadChildren: () => import('../admin/admin.routes'),
                data: { title: 'Admin' },
            },
            {
                path: 'cfp',
                loadComponent: () => import('../cfp/cfp.component'),
                data: { title: 'Call For Papers' },
                providers: [importProvidersFrom([AngularFirestoreModule])],
            },
            { path: '', loadChildren: () => import('../main/main.routes') },
        ],
    },
];

export default AuthenticatedRoutes;
