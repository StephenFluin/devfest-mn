import { AuthService } from '../realtime-data/auth.service';

/**
 * Asks the server to copy this year's Eventbrite orders and promo code usage into the database
 * (see /api/admin/burndown/update in src/server.ts). Used by the ticket burndown and the Campaigns
 * page. Resolves to a short message for the admin.
 */
export async function syncEventbrite(auth: AuthService): Promise<string> {
  const idToken = await auth.auth?.currentUser?.getIdToken();
  const response = await fetch('/api/admin/burndown/update', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? 'Update failed');
  }
  return `Loaded ${result.orders} orders.`;
}
