# DevFestMN

This is the website for [DevFestMN](https://devfest.mn), the annual Twin Cities developer conference run by
GDG Twin Cities. The site is how attendees, speakers, and sponsors find and take part in the event:

- **Attendees** see the date, venue, schedule, and speakers, and buy tickets through Eventbrite.
- **Speakers** read the call for papers and submit talks.
- **Sponsors** learn about sponsorship and see who already supports the event.
- **Organizers** use the admin pages to manage speakers, sessions, and the schedule, and to track ticket sales.

Follow DevFestMN on [Bluesky](https://bsky.app/profile/devfestmn.bsky.social) and
[Mastodon](https://developers.live/@devfestmn).

**Lead maintainer:** [Stephen Fluin](https://github.com/StephenFluin)
([Mastodon](https://developers.live/@StephenFluin)). Questions about the event go to
[info@devfest.mn](mailto:info@devfest.mn).

## Quick start

```bash
npm install
npm start
```

Then open http://localhost:4200/. The app reloads automatically when you change a source file.

## Contributing

1. Create a branch and make your changes.
2. Check them locally with `npm start` (and `npm run build` for a production build).
3. Open a pull request against `main`.
4. Once it's approved and merged, the site deploys automatically.

## How the site is built and deployed

The site is an Angular app with server-side rendering. Data such as talks, speakers, and the schedule lives in
the Firebase Realtime Database, and speaker photos live in Firebase Storage.

It's served by **Firebase App Hosting** (backend `devfestmn-2026-webapp`, configured in `firebase.json` and
`apphosting.yaml`). Every merge to `main` triggers a new App Hosting rollout to https://devfest.mn, so there's
no manual deploy step for the website.

Database and Storage security rules (`database.rules.json` and `storage.rules`) aren't deployed by App
Hosting. To change them, sign in and deploy just the rules. The Firebase CLI is a project dependency, so run it
with `npx` rather than installing it globally:

```bash
npx firebase login
```

```bash
npx firebase deploy --only database,storage
```

## Yearly updates

We keep the same codebase every year but move to a new Firebase project.

1. Create the new Firebase project and an App Hosting backend connected to this repo.
2. Point `.firebaserc` at the new project, and update the `backendId` in `firebase.json`.
3. Update `src/environments/environment.ts` with the new Firebase config, event date, CFP dates, venue, and
   feature flags (`showSchedule`, `showRegister`, and so on). The call for speakers shows while `cfpCloses` is set and hasn't passed; set it to `null` for a new year until the CFP is announced.
4. Find and replace the old year and date throughout the code.
5. Update the date in `scripts/og-image.sh` and run it to regenerate the social share image.
6. Carry the ticket history forward (see [Ticket burndown](#ticket-burndown)).
7. Point last year's archive at its own subdomain (see [Archiving a past year](#archiving-a-past-year)).

## Archiving a past year

Each past year stays online at `https://<year>.devfest.mn` (for example the `2025` branch and `2025-final` tag).
Before the new year launches on https://devfest.mn, update the archive so search engines don't mix the two:

- In the archive's `src/environments/environment.ts`, set `siteUrl` to `https://<year>.devfest.mn` and `year`
  to the archived year. Canonical links, `og:url`, and `sitemap.xml` are all built from `siteUrl`, so pages
  then point at the archive instead of claiming to be the current site.
- Check that canonical links are absolute URLs on the subdomain, e.g. `https://2025.devfest.mn/speakers/…`,
  not relative paths like `/2025/speakers/…` or `https://devfest.mn/…`.
- Spot-check the deployed archive with `curl -s https://<year>.devfest.mn/sitemap.xml` and the canonical tag on
  a speaker page.

If this is skipped, Google finds last year's speaker and session URLs on devfest.mn, where they don't exist, and
reports them as duplicates in Search Console. (The current site now answers those with a 404, but the archive's
links should still be fixed.)

Each archive lives on a `<year>` branch, cut from that year's `<year>-final` tag, and deploys to that year's
Firebase project. Commit fixes to the branch, push it, then deploy:

- **2025 and later (App Hosting):** roll out the branch to the year's backend, e.g.

  ```bash
  npx firebase apphosting:rollouts:create devfest-mn --git-branch 2025 --project devfestmn-2025
  ```

- **2024 (static Firebase Hosting):** install with Yarn (`yarn install --frozen-lockfile`), run `npx ng build`,
  then from the branch checkout run `npx firebase deploy --only hosting --project devfestmn-2024`.

## Photo gallery

Gallery photos go in `src/a/images/gallery/<year>/`. Before adding them, compress each photo to 50% quality
and resize it to fit within 1024x768 while keeping the aspect ratio. This command does that for every image
under the current directory and keeps a `.original` backup of each one (it needs ImageMagick):

```bash
find . -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" \) -exec sh -c '
    echo "Processing: $1"
    # Create backup with .original extension if it doesn'\''t exist
    if [ ! -f "$1.original" ]; then
        cp "$1" "$1.original"
        echo "Created backup: $1.original"
    fi

    # Compress and resize the image
    convert "$1" -quality 50 -resize "1024x768>" "$1.compressed"

    # Replace original with compressed version
    mv "$1.compressed" "$1"

    echo "Compressed: $1"
    echo "---"
' _ {} \;
```

Then generate the small WebP previews the gallery grid uses (existing ones are skipped):

```bash
scripts/gallery-thumbnails.sh
```

## Ticket burndown

The admin burndown page (`/admin/burndown`) charts ticket sales over time. It reads anonymous order data
(day, time, tickets, price, and the Eventbrite affiliate code the order was placed with) from
`burndown/<year>` in the Realtime Database, plus promo code usage under `burndown/<year>/discounts`.

"Update from Eventbrite" (on the burndown and Campaigns pages) rewrites the current year only. It uses the
`eventbriteToken` App Hosting secret in production, or `EVENTBRITE_TOKEN` in a local `.env` file during
development.

Past years are kept in `data/burndown-history.json`. When the site moves to a new Firebase project, copy the
current year into that file and load it into the new project:

```bash
npx firebase database:update /burndown data/burndown-history.json --project <new-project>
```

## UTM funnel

The admin UTM funnel page (`/admin/utm-funnel`) tables visits, engaged visits, ticket sales, and clicks through
to the external CFP form by UTM source,
medium, and campaign. A visit is credited to the last campaign the visitor arrived from in the past 30 days
(the same attribution passed to Eventbrite checkout), or to the linking site when there's no campaign.

The site records this itself rather than through Google Analytics. The browser sends small events to
`/api/visit` (`src/app/visit-tracker.ts`), and the server writes them to `analytics/<year>/sessions`
(`src/visit-analytics.ts`). Visits are anonymous: no IP address, user agent, or ID that links visits together
is stored.

Browsers can't write to `analytics`, so the server writes with its own identity, the App Hosting compute
service account. If visits don't show up after a deploy, check the server logs for permission errors and grant
that account (`firebase-app-hosting-compute@<project>.iam.gserviceaccount.com`) the **Firebase Realtime
Database Admin** role. Locally, events are dropped unless `FIREBASE_DATABASE_EMULATOR_HOST` points at the
Realtime Database emulator.

## Growing attendance

Most people who'd enjoy DevFestMN have never heard of it. The site has two loops for reaching them, both
measured in the admin so effort and money go where tickets come from.

### Campaigns: short links, QR codes and promo codes

The admin Campaigns page (`/admin/campaigns`) creates one short link per place the event is promoted: a
meetup listing, a partner company, a sponsor's newsletter, a poster, an ad. Pick a preset (it prefills the
UTM source and medium and says where to put the link), give it a name, and the page shows:

- `https://devfest.mn/go/<slug>`, which 302-redirects to the landing page tagged with `utm_source`,
  `utm_medium`, `utm_campaign` and `aff=<slug>`. The site remembers the campaign for 30 days (like the UTM
  funnel) and passes the slug to Eventbrite checkout as its **affiliate code**, so Eventbrite records which
  campaign each order came from, even on a later visit or another device.
- `https://devfest.mn/go/<slug>.png`, a printable QR code of the link, for posters, slides and flyers.
- Optionally a **promo code**: the server creates it in Eventbrite as a coded discount (percent off, with an
  optional number of uses) and the link pre-applies it in checkout. This is how partners, communities and
  companies get a deal of their own to pass along, and how you see how many used it.
- Visits, engaged visits and on-site sales (from the UTM funnel), plus tickets and revenue Eventbrite credits
  to the slug, and cost per ticket once spend is entered. Click **Update from Eventbrite** to refresh the
  Eventbrite numbers.

The page's **Word of mouth** table measures the two links the site hands out on its own: the share prompt
shown after someone buys a ticket (`utm_source=attendee`) and speakers' `/s/` links (`utm_source=speaker`).

Campaigns live in two halves under `marketing/<year>` in the Realtime Database: `links/<slug>` is public
(the server reads it to redirect) and holds only what the redirect needs; `campaigns/<slug>` is admin-only
(name, notes, spend, Eventbrite discount id). Deleting a campaign doesn't delete its promo code from
Eventbrite.

For paid campaigns, also set `adConversions.googleAds` in `src/environments/environment.ts` to the Google
Ads conversion id so completed orders are reported as conversions and Google Ads learns which clicks sold
tickets.

### Share prompts for attendees and speakers

When an Eventbrite order completes on the site, a **"You're in!"** panel offers ready-made posts for
LinkedIn, Bluesky and X, an email, a copy-to-clipboard version for Slack and Mastodon, and the day as a
calendar entry (`/calendar/devfestmn-<year>.ics`). Each post links back tagged with the network, so the
funnel shows which networks attendees' posts convert on.

Confirmed speakers see a **Share your talk** kit on their edit page (`/speaker-edit/<token>/edit`): their
share card, their `/s/<name>` link and a post per network. The same kit appears in the admin speaker editor,
with **Email their share kit**, which sends it to an invited speaker. The `/s/` link takes `?m=<network>`
so the funnel splits speaker traffic by network too.

Setup: deploy the database rules (`marketing` is new). Emailing share kits uses Resend, as described under
[Inviting speakers](#inviting-speakers-to-edit-their-own-profile).

## Announcing speakers

Speakers are added in the admin (`/admin/speakers/new/edit`) and only appear publicly once marked
**Confirmed**. Each speaker page sets its own title, description (leading with the talk), share image, and
`Person` structured data, and the home page lists confirmed speakers as the event's `performer`s.

1. Mark speakers **Confirmed** in the admin. Once at least one is, the site adds the Speakers nav link, the
   home page's speakers section, and `/speakers` plus every confirmed speaker in `/sitemap.xml`, with no
   deploy. Confirming a speaker publishes them, so confirm everyone together to announce the lineup at once.
2. Each confirmed speaker's share image is a 1200x630 card (photo, name, company, talk) rendered by the server
   at `/og/speakers/<key>.png` (`src/speaker-card.ts`). Nothing to generate: cards update when the speaker or
   their sessions are saved, since the image URL carries their `updatedAt`.
3. Give each speaker their short link, `https://devfest.mn/s/<name-slug>` (shown in the speaker editor). It
   302-redirects to their page with `utm_source=speaker&utm_medium=social&utm_campaign=speaker_<name-slug>`, so
   the UTM funnel shows which speakers drive visits, ticket sales, and CFP clicks.
4. In Google Search Console, submit `https://devfest.mn/sitemap.xml` (it replaces `sitemap.txt`, which still
   works) and request indexing for the new speaker pages. Each page's `lastmod` is when it was last saved in
   the admin.

### Inviting speakers to edit their own profile

On `/speakers`, admins can click **Invite Speaker** and enter a name and email. That creates an unconfirmed
speaker and emails them a private link, `https://devfest.mn/speaker-edit/<token>/edit`.
The token is random (not the speaker's database key, which is public), and anyone with the link can edit that
one speaker's name, bio, company, links, and photo, but can't confirm, create, or delete speakers. The
speaker editor shows the link again, with an **Email it again** button, for invited speakers.

Email goes through [Resend](https://resend.com) from the server (`src/mailer.ts`, behind a small `Mailer`
interface so the provider can be swapped). Setup, once:

- Verify the `devfest.mn` domain in Resend, so it can send as `MAIL_FROM` in `apphosting.yaml`.
- Store the API key as an App Hosting secret, and let the backend read it if the command doesn't offer to:

```bash
npx firebase apphosting:secrets:set resendApiKey
```

```bash
npx firebase apphosting:secrets:grantaccess resendApiKey --backend devfestmn-2026-webapp
```

Locally, emails are printed to the server log instead of sent, unless `.env` has `RESEND_API_KEY` (and
optionally `MAIL_FROM`). `MAIL_PROVIDER=console` or `MAIL_PROVIDER=resend` forces one or the other.

The edit page signs visitors in with Firebase **anonymous auth**, and the database rules
(`speakerInvites` and `speakerGrants` in `database.rules.json`) only let a signed-in user edit a speaker after
presenting a valid token. So this needs:

- Anonymous sign-in enabled in the Firebase console (Authentication → Sign-in method → Anonymous), once per
  year's project.
- The database rules deployed (see [How the site is built and deployed](#how-the-site-is-built-and-deployed)).

Speakers upload their photo through the server (`POST /api/speaker-edit/<token>/photo`), because the Storage
rules only let admins upload. The server checks the token and writes the file to
`devfest<year>/speakers/<key>/` with its App Hosting service account, which needs permission to create objects
in the bucket. If uploads fail with a Storage 403 in the App Hosting logs, grant it:

```bash
gcloud storage buckets add-iam-policy-binding gs://devfestmn-2026.firebasestorage.app --member=serviceAccount:firebase-app-hosting-compute@devfestmn-2026.iam.gserviceaccount.com --role=roles/storage.objectCreator
```

Locally there are no Google credentials, so to try uploads run the server with
`FIREBASE_DATABASE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST` pointing at the emulators.

Speakers can also edit the **title and description** of each talk they're on, from the same page. They can't
create talks or change anything else (time, room, length, track, notes or who's presenting): an admin creates
the session and adds the speaker to it first. The database rules can't tell who presents a session (its
speakers are stored under push IDs), so these saves go through the server
(`POST /api/speaker-edit/<token>/sessions/<key>`), which checks the speaker is on that session and writes only
those two fields with its service account. Locally, set `FIREBASE_DATABASE_EMULATOR_HOST` to try it.

To revoke a link, delete its entry under `devfest<year>/speakerInvites` in the Realtime Database console. Anyone
who already opened it keeps access until you also delete their entry under `devfest<year>/speakerGrants`.
