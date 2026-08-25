import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
} from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);

// Cross-platform persistence (AsyncStorage for native, localStorage for web)
function getPlatformAuth() {
  if (Platform.OS === 'web') {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    try {
      const authModule: any = require('firebase/auth');
      if (authModule.getReactNativePersistence) {
        return initializeAuth(app, {
          persistence: authModule.getReactNativePersistence(AsyncStorage),
        });
      }
      // @ts-ignore
      const rnAuth = require('@firebase/auth/dist/rn/index.js');
      return initializeAuth(app, {
        persistence: rnAuth.getReactNativePersistence(AsyncStorage),
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
