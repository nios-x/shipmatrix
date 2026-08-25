import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile replacement for window.localStorage / window.sessionStorage.
 * On mobile, there's no concept of sessionStorage, so both types use AsyncStorage.
 * All operations are async unlike the web version.
 */

export const safeGetItem = async (
  _type: 'local' | 'session',
  key: string
): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

export const safeSetItem = async (
  _type: 'local' | 'session',
  key: string,
  value: string
): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    // Silently fail, matching web behavior
  }
};

export const safeRemoveItem = async (
  _type: 'local' | 'session',
  key: string
): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    // Silently fail, matching web behavior
  }
};
