// Shared Firebase configuration.
//
// This file intentionally has NO platform suffix. `firebase.ts` (web) and
// `firebase.native.ts` (native) both import it. Never import './firebase'
// from firebase.native.ts — Metro prefers `.native.ts` over `.ts`, so that
// specifier resolves back to firebase.native.ts itself and the re-export
// getters recurse infinitely ("Maximum call stack size exceeded").

// Firebase configuration
export const firebaseConfig = {
  projectId: 'abcdef-28f0d',
  appId: '1:191165632248:web:e768361e3e07634d3cb50d',
  apiKey: 'AIzaSyDSNiwYsc8n3SZqoaUYcG100MFDhWkjGdI',
  authDomain: 'abcdef-28f0d.firebaseapp.com',
  storageBucket: 'abcdef-28f0d.firebasestorage.app',
  messagingSenderId: '191165632248',
  measurementId: 'G-FD6EZ1R06P',
};

// Must match FIRESTORE_DATABASE_ID on the payments server, or the two will
// read and write different databases without either of them erroring.
export const firestoreDatabaseId = '(default)';
