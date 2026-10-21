// Gives (or removes) the `admin: true` custom claim that storage.rules checks before allowing
// speaker image uploads. Storage rules can't read /admin in the Realtime Database, so anyone
// listed there also needs this claim to upload images.
//
// Usage (needs Google credentials for the project, e.g. `gcloud auth application-default login`):
//   npm install --no-save firebase-admin
//   node scripts/set-admin-claim.mjs <email> [--remove]
//
// The user has to sign out and back in (or wait up to an hour) before the new claim takes effect.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node scripts/set-admin-claim.mjs <email> [--remove]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'devfestmn-2026' });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const { admin, ...otherClaims } = user.customClaims ?? {};
await auth.setCustomUserClaims(
  user.uid,
  flag === '--remove' ? otherClaims : { ...otherClaims, admin: true },
);
console.log(`${flag === '--remove' ? 'Removed' : 'Set'} admin claim for ${email} (${user.uid})`);
