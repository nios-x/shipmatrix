import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import { firebaseConfig, firestoreDatabaseId } from './firebase-config';

export { firebaseConfig, firestoreDatabaseId };

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Web platform authentication with localStorage persistence
function getPlatformAuth() {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
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
