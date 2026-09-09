import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import { safeGetItem, safeSetItem } from './storage';

const DEVICE_ID_KEY = 'pushDeviceId';

// Foreground behaviour: a push that arrives while the app is open still shows
// as a banner/list entry, matching what the user would see if it arrived
// while the app was backgrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * A stable per-install id, generated once and reused as the Firestore
 * document id for this device's token — so re-registering (app restart,
 * token refresh) updates the same doc instead of accumulating duplicates,
 * and a later sign-out can delete exactly this device's entry.
 */
async function getDeviceId(): Promise<string> {
  const existing = await safeGetItem('local', DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await safeSetItem('local', DEVICE_ID_KEY, id);
  return id;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7C3AED',
  });
}

/**
 * Requests permission, fetches an Expo push token and stores it at
 * `users/{uid}/pushTokens/{deviceId}` — a subcollection the app itself owns,
 * mirroring `notifications`/`transactions`. The payments server reads it to
 * actually send pushes (see `services/services/push.ts` in the server repo).
 *
 * Never throws: a denied permission, a simulator with no push service, or an
 * offline device should not block sign-in, so every failure just skips
 * registration silently. Safe to call repeatedly (e.g. every sign-in).
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<string | null> {
  if (!Device.isDevice) return null; // Simulators/emulators have no push service.

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceId = await getDeviceId();

    await setDoc(
      doc(db, 'users', uid, 'pushTokens', deviceId),
      {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${uid}/pushTokens`);
    return null;
  }
}

/** Removes this device's token — called on sign-out and when push is toggled off. */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', deviceId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `users/${uid}/pushTokens`);
  }
}
