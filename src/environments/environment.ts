export const environment = {
    year: '2025',
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
    showRegister:
        'https://www.eventbrite.com/e/devfestmn-2025-tickets-1684295616529?aff=oddtdtcreator',
    showSchedule: true,
    showCFP: false,
    showSpeakers: true,
    showSponsor: true,
    showFeedback: false,
    eventbriteEventId: '1684295616529',
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
                    url: 'https://someconf.com/?apply_somecoupon=devfest2025',
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
