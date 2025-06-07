import { importProvidersFrom } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { Routes } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { FirebaseService } from '../realtime-data/firebase.service';
import { DataService } from '../shared/data.service';

export const AuthenticatedRoutes: Routes = [
    {
        path: '',
        pathMatch: 'prefix',
        providers: [
            DataService,
            importProvidersFrom(AngularFireModule.initializeApp(environment.firebaseConfig)),
            provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
            provideDatabase(() => getDatabase()),
            provideAuth(() => getAuth()),
            AuthService,
            FirebaseService,
        ],
        children: [
            {
                path: 'test',
                loadComponent: () => import('../home/home.component').then((m) => m.HomeComponent),
            },
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
