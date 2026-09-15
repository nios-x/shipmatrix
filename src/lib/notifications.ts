import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * `expo-notifications`, or null where it cannot be loaded.
 *
 * Android push was removed from Expo Go in SDK 53, and the library enforces
 * that by throwing — not when push is used, but when the package is imported:
 * its index pulls in an auto-registration module that attaches a push-token
 * listener at load time. A static `import * as Notifications` anywhere on the
 * startup path therefore kills the app in Expo Go before a screen renders.
 *
 * Resolving it lazily, the same way `cashfree.ts` handles its native SDK, lets
 * the rest of the app run in Expo Go with push simply switched off. Callers
 * must treat null as "push unavailable here" and skip quietly. Development and
 * store builds, and iOS Expo Go (which only warns), get the real module.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
