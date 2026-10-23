/**
 * OAuth tokens for the service account the server runs as (the App Hosting service account, from
 * the Cloud Run metadata server). Requests made with it are checked by IAM, not by the Firebase
 * security rules, so the rules can keep refusing those writes from browsers.
 */
const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' +
  '?scopes=' +
  [
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/devstorage.read_write',
  ].join(',');
let cachedToken: { value: string; expires: number } | undefined;
let noCredentials = false;

/** An OAuth token for the server's service account, or undefined off Google Cloud. */
export async function googleAccessToken(): Promise<string | undefined> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  if (noCredentials) return undefined;
  let response: Response;
  try {
    response = await fetch(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    noCredentials = true;
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Metadata server responded with ${response.status}`);
  }
  const { access_token, expires_in } = await response.json();
  cachedToken = { value: access_token, expires: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}
