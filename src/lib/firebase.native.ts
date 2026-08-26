import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
} from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, firestoreDatabaseId } from './firebase';

export { firebaseConfig, firestoreDatabaseId };

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// React Native platform authentication with AsyncStorage persistence
function getPlatformAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = getPlatformAuth();

// Initialize Firestore with the specified database ID
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firestoreDatabaseId
);

export const storage = getStorage(app);
