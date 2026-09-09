/**
 * Maps a notification's `actionLink` (e.g. '/dashboard?tab=wallet') to the
 * in-app tab/screen it should open.
 *
 * Shared between the in-app notification list (NotificationsScreen) and a
 * tapped OS push notification (usePushNotifications), so both land in the
 * same place for the same link — the server writes one `actionLink` and
 * expects it to work from either surface.
 */
export const NOTIFICATION_TAB_ROUTES: Record<string, { tab: string; screen?: string }> = {
  wallet: { tab: 'WalletTab' },
  billing: { tab: 'WalletTab', screen: 'Billing' },
  cod: { tab: 'WalletTab', screen: 'CodRemittance' },
  orders: { tab: 'OrdersTab' },
  rates: { tab: 'RatesTab' },
  profile: { tab: 'ProfileTab' },
  ndr: { tab: 'HomeTab', screen: 'Ndr' },
  returns: { tab: 'ProfileTab', screen: 'Returns' },
  tracking: { tab: 'HomeTab', screen: 'Tracking' },
};

export function resolveNotificationTarget(
  actionLink?: string | null
): { tab: string; screen?: string } | null {
  const match = actionLink?.match(/tab=([^&]+)/);
  if (!match) return null;
  return NOTIFICATION_TAB_ROUTES[match[1].toLowerCase()] ?? null;
}
