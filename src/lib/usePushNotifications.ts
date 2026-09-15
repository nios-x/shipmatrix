import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { navigationRef } from '../navigation/navigationRef';
import { resolveNotificationTarget } from './notificationRouting';
import { registerForPushNotificationsAsync, unregisterPushToken } from './pushNotifications';
import { getNotifications } from './notifications';

function navigateToTarget(actionLink: unknown) {
  if (typeof actionLink !== 'string') return;
  const target = resolveNotificationTarget(actionLink);
  if (!target || !navigationRef.isReady()) return;
  // Cross-stack navigation (tab -> nested screen) isn't expressible in
  // RootStackParamList's types; the rest of the app sidesteps the same gap
  // with `useNavigation<any>()` (see NotificationsScreen.handleAction).
  (navigationRef as any).navigate('Main', {
    screen: target.tab,
    params: target.screen ? { screen: target.screen } : undefined,
  });
}

/**
 * Keeps this device's push registration in sync with auth state and the
 * user's "Push Notifications" preference (Settings screen), and routes a
 * tapped push to the same screen its in-app twin would open — including a
 * tap that launched the app from a killed state.
 *
 * Mounted once from RootNavigator, which already owns the app's one auth
 * listener and the NavigationContainer this needs a ready ref to.
 */
export function usePushNotifications() {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const uid = useSelector((s: RootState) => s.auth.user?.id);
  const pushEnabled = useSelector(
    (s: RootState) => s.auth.user?.notificationPrefs?.pushNotif ?? true
  );

  useEffect(() => {
    if (!isAuthenticated || !uid) return;
    if (pushEnabled) {
      void registerForPushNotificationsAsync(uid);
    } else {
      void unregisterPushToken(uid);
    }
  }, [isAuthenticated, uid, pushEnabled]);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return; // Android Expo Go: no push, so nothing to route.

    // A tap that launched the app from a killed state has already happened by
    // the time the listener below attaches, so it has to be read separately.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      navigateToTarget(last.notification.request.content.data?.actionLink);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToTarget(response.notification.request.content.data?.actionLink);
    });

    return () => subscription.remove();
  }, []);
}
