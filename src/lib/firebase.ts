import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
} from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration — same project as the website
const firebaseConfig = {
  projectId: 'gen-lang-client-0372703048',
  appId: '1:563260211850:web:87ac338a21dec8ed9be373',
  apiKey: 'AIzaSyDPpSAb-BkkXr5nG3wpUyWV96kEjLyPF78',
  authDomain: 'gen-lang-client-0372703048.firebaseapp.com',
  storageBucket: 'gen-lang-client-0372703048.firebasestorage.app',
  messagingSenderId: '563260211850',
  measurementId: 'G-0YSPEQW5VY',
};

const firestoreDatabaseId = 'ai-studio-6bb82760-6011-4cd2-a03f-d981814aeddd';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Cross-platform persistence (AsyncStorage for native, localStorage for web)
function getPlatformAuth() {
  if (Platform.OS === 'web') {
    try {
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } catch {
      return getAuth(app);
    }
  } else {
    try {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      return getAuth(app);
    }
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
