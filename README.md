# DevFestMN

This is the website for [DevFestMN](https://devfest.mn), the annual Twin Cities developer conference run by
GDG Twin Cities. The site is how attendees, speakers, and sponsors find and take part in the event:

-   **Attendees** see the date, venue, schedule, and speakers, and buy tickets through Eventbrite.
-   **Speakers** read the call for papers and submit talks.
-   **Sponsors** learn about sponsorship and see who already supports the event.
-   **Organizers** use the admin pages to manage speakers, sessions, and the schedule, and to track ticket sales.

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
   feature flags (`showCFP`, `showSchedule`, `showSpeakers`, and so on).
4. Find and replace the old year and date throughout the code.
5. Update the date in `scripts/og-image.sh` and run it to regenerate the social share image.
6. Carry the ticket history forward (see [Ticket burndown](#ticket-burndown)).

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
(day, time, tickets, price) from `burndown/<year>` in the Realtime Database.

"Update from Eventbrite" rewrites the current year only. It uses the `eventbriteToken` App Hosting secret in
production, or `EVENTBRITE_TOKEN` in a local `.env` file during development.

Past years are kept in `data/burndown-history.json`. When the site moves to a new Firebase project, copy the
current year into that file and load it into the new project:

```bash
npx firebase database:update /burndown data/burndown-history.json --project <new-project>
```
