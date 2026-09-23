export const environment = {
    year: '2026',
    siteName: 'DevFestMN',
    firebaseConfig: {
        apiKey: 'AIzaSyC6c2soUhewnosbGiLJJLoF3a7Q54InVk0',
        authDomain: 'devfestmn-2026.firebaseapp.com',
        databaseURL: 'https://devfestmn-2026-default-rtdb.firebaseio.com',
        projectId: 'devfestmn-2026',
        storageBucket: 'devfestmn-2026.firebasestorage.app',
        messagingSenderId: '126057052732',
        appId: '1:126057052732:web:f8faf33a6c99b9fcc1e139',
        measurementId: 'G-ZTW1VG9TDH',
    },
    showRegister: false,
        //'https://www.eventbrite.com/e/devfestmn-2025-tickets-1684295616529?aff=oddtdtcreator',
    showSchedule: false,
    showCFP: false,
    showSpeakers: false,
    showSponsor: true,
    showFeedback: false,
    showVolunteer: false,//'https://signup.com/go/wWAHYET',
    dayOf: false,
    surveyLink: 'https://forms.gle/73k2ZXYqiGpRabkv6',
    eventbriteEventId: '1996529152440',
    venueMapUrl: 'https://maps.app.goo.gl/w1nJNEmjhe3cvMKg7',
    sponsors: [
        {
            type: 'Premiere',
            list: [
                {
                    name: 'Google',
                    logo: '/a/images/sponsors/google.svg',
                    url: 'https://cloud.google.com/',
                },
                {
                    name: 'Livefront',
                    logo: '/a/images/sponsors/livefront.svg',
                    url: 'https://www.livefront.com/',
                },
            ],
        },
        {
            type: 'Community',
            list: [
                {
                    name: 'SomeConf',
                    logo: '/a/images/sponsors/someconf.png',
                    url: 'https://someconf.com/?apply_somecoupon=devfest2026',
                },
                {
                    name: 'ImpactPharm',
                    logo: '/a/images/sponsors/impactpharm.webp',
                    url: 'http://impactpharm.app/',
                },
            ],
        },
    ],
};
