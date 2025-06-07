// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `angular-cli.json`.

export const environment = {
    production: false,
    defaultYear: '2025',
    siteName: 'DevFestMN',
    firebaseConfig: {
        apiKey: 'AIzaSyCof6ntfAVNvyLmcaPvCkJOtkLa3ARffxc',
        authDomain: 'devfestmn-2025.firebaseapp.com',
        databaseURL: 'https://devfestmn-2025-default-rtdb.firebaseio.com',
        projectId: 'devfestmn-2025',
        storageBucket: 'devfestmn-2025.firebasestorage.app',
        messagingSenderId: '870313152725',
        appId: '1:870313152725:web:837dcb46f7f04730fc525c',
        measurementId: 'G-XNZWL27N39',
    },
    showRegister: false,
    //'https://www.eventbrite.com/e/1082249821349?aff=devfestmnwebsite',
    showSchedule: false,
    showSpeakers: false,
};
