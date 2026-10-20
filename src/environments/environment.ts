export const environment = {
    year: '2026',
    siteName: 'DevFestMN',
    siteUrl: 'https://devfest.mn',
    siteDescription:
        'DevFestMN 2026 is a one-day Twin Cities developer conference on Saturday, December 5th, covering AI, agents, cloud, mobile, and the web.',
    socialImage: '/a/images/og-image.jpg',
    contactEmail: 'info@devfest.mn',
    eventDate: '2026-12-05',
    eventDateDisplay: 'Saturday, December 5th',
    cfpOpens: '2026-09-29',
    /**
     * Last day to submit a talk (until 11:59pm Central). The call for speakers shows only while this
     * is set and hasn't passed; set it to null for a new year until the CFP is announced.
     */
    cfpCloses: '2026-10-20' as string | null,
    cfpLink: 'https://forms.gle/ogepGnFYvvc68Wup6',
    firebaseConfig: {
        apiKey: 'AIzaSyC6c2soUhewnosbGiLJJLoF3a7Q54InVk0',
        authDomain: 'devfestmn-2026.firebaseapp.com',
        databaseURL: 'https://devfestmn-2026-default-rtdb.firebaseio.com',
        projectId: 'devfestmn-2026',
        storageBucket: 'devfestmn-2026.firebasestorage.app',
        messagingSenderId: '126057052732',
        appId: '1:126057052732:web:dce9551e4bb4ae60c1e139',
    },
    showRegister: true,
    showSchedule: false,
    showSponsor: true,
    showFeedback: false,
    showVolunteer: false,//'https://signup.com/go/wWAHYET',
    surveyLink: 'https://forms.gle/73k2ZXYqiGpRabkv6',
    eventbriteEventId: '1996529152440',
    venueName: 'University of St. Thomas | Schulze Hall',
    venueAddress: '46 S 11th St, Minneapolis, MN 55403',
    venueMapUrl:
        'https://www.google.com/maps/place/Schulze+Hall/@44.974195,-93.279928,17z/data=!3m1!4b1!4m2!3m1!1s0x52b332944d7d30f9:0x169d5a902717f38e?hl=en',
    parkingName: '11th & Harmon Parking Ramp',
    parkingAddress: '25 S 11th St, Minneapolis, MN 55403',
    /**
     * Default rooms, used until rooms are saved at /admin/rooms (which then take over). In
     * schedule-column order; `directions` shows on the home page and on sessions in that room.
     */
    venueRooms: [
        {
            name: 'Auditorium',
            directions: 'The main conference hall. From registration on the ground floor, follow the DevFestMN signs.',
        },
        {
            name: 'Schulze 127',
            directions: 'Room 127, down the hallway from the Auditorium. Follow the DevFestMN signs.',
        },
    ],
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
                    logo: '/a/images/sponsors/someconf.webp',
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
