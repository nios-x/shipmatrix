// Shared Firebase configuration.
//
// This file intentionally has NO platform suffix. `firebase.ts` (web) and
// `firebase.native.ts` (native) both import it. Never import './firebase'
// from firebase.native.ts — Metro prefers `.native.ts` over `.ts`, so that
// specifier resolves back to firebase.native.ts itself and the re-export
// getters recurse infinitely ("Maximum call stack size exceeded").

// Firebase configuration — same project as the website
export const firebaseConfig = {
  projectId: 'gen-lang-client-0372703048',
  appId: '1:563260211850:web:87ac338a21dec8ed9be373',
  apiKey: 'AIzaSyDPpSAb-BkkXr5nG3wpUyWV96kEjLyPF78',
  authDomain: 'gen-lang-client-0372703048.firebaseapp.com',
  storageBucket: 'gen-lang-client-0372703048.firebasestorage.app',
  messagingSenderId: '563260211850',
  measurementId: 'G-0YSPEQW5VY',
};

export const firestoreDatabaseId = 'ai-studio-6bb82760-6011-4cd2-a03f-d981814aeddd';
