# Install the 2026 sponsor admin

Stephen, please deploy the Firebase rules and import the existing sponsors into
`devfestmn-2026` before merging the sponsor admin change. App Hosting deploys merges to
`main` automatically. The new home page reads its sponsor list from Firebase as soon as it goes live.

1. From the checkout with the sponsor admin changes, run `npm ci` and `npx firebase login` with
   an account that can deploy the project's Realtime Database and Storage rules and write the
   sponsor records.
2. Compare the production rules in the Firebase console with
   [database.rules.json](../database.rules.json) and [storage.rules](../storage.rules). Carry any
   unrelated production changes forward before deploying the rules.

   ```bash
   npx firebase deploy --only database,storage --project devfestmn-2026
   ```

3. Check the production sponsor path.

   ```bash
   npx firebase database:get /devfest2026/sponsors --project devfestmn-2026 --instance devfestmn-2026-default-rtdb
   ```

   If it returns `null`, import [the 2026 sponsor list](../data/sponsors-2026.json).

   ```bash
   npx firebase database:set /devfest2026/sponsors data/sponsors-2026.json --project devfestmn-2026 --instance devfestmn-2026-default-rtdb
   ```

   If the path already contains records, preserve them and reconcile any missing sponsors
   individually. The import command replaces the entire sponsor list.

4. Confirm the public query returns Google and Livefront at the Premiere level and ImpactPharm at
   the Community level. All three should have `visible: true`.

   ```bash
   curl --fail --silent --show-error --get \
     'https://devfestmn-2026-default-rtdb.firebaseio.com/devfest2026/sponsors.json' \
     --data-urlencode 'orderBy="visible"' \
     --data-urlencode 'equalTo=true'
   ```

5. Merge the app change. After App Hosting rolls it out, check the three linked logos on the
   [home page](https://devfest.mn/) and confirm they are marked **Visible** in
   [Sponsors](https://devfest.mn/admin/sponsors).
