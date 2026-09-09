import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Lets code outside the component tree (a tapped push notification, handled
 * before any screen has mounted) navigate the same way `useNavigation()`
 * would from inside it.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
