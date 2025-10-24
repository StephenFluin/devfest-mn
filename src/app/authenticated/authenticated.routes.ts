import { importProvidersFrom } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { AngularFireModule } from '@angular/fire/compat';
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
        providers: [],
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
        ],
    },
];

export default AuthenticatedRoutes;
