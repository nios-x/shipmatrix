import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import type { User } from '../types';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (authUser) {
        unsubscribeSnapshot = onSnapshot(
          doc(db, 'users', authUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              setUser({ id: docSnap.id, ...docSnap.data() } as User);
            } else {
              // Creating minimal user state so they aren't blocked silently
              setUser({
                id: authUser.uid,
                email: authUser.email || undefined,
                role: 'user',
                walletBalance: 0,
                needsOnboarding: true,
              });
            }
            setLoading(false);
          },
          (error) => {
            handleFirestoreError(
              error,
              OperationType.GET,
              `users/${authUser.uid}`
            );
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, []);

  return { user, loading };
}
