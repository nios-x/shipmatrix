import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import type { User as AuthUser } from 'firebase/auth';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import type { User } from '../types';

/**
 * A user document can come into existence without ever passing through signup —
 * the payments server creates one with a merge-write when it credits a wallet,
 * for instance — which leaves a profile with a balance but no identity. Auth
 * holds the real name and email, so fill them in the first time we notice.
 *
 * Deliberately never writes `role` or `walletBalance`. Those are privilege and
 * money: `role === 'admin'` unlocks the admin panel, and the balance is the
 * payment server's alone. Neither may be set by a client.
 */
async function backfillIdentity(
  authUser: AuthUser,
  data: Record<string, unknown> | undefined
): Promise<void> {
  const patch: Record<string, string> = {};
  if (!data?.name && authUser.displayName) patch.name = authUser.displayName;
  if (!data?.email && authUser.email) patch.email = authUser.email;
  if (Object.keys(patch).length === 0) return;

  try {
    // The resulting snapshot re-runs this with the fields now present, so the
    // patch comes out empty and it settles after one write.
    await updateDoc(doc(db, 'users', authUser.uid), patch);
  } catch (e) {
    // Best effort. The screen already rendered whatever the document had.
    handleFirestoreError(e, OperationType.UPDATE, `users/${authUser.uid}`);
  }
}

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
              const data = docSnap.data();
              setUser({ id: docSnap.id, ...data } as User);
              void backfillIdentity(authUser, data);
            } else {
              // Creating minimal user state so they aren't blocked silently.
              // Name and email are carried over from the Auth record — signup
              // writes both there via updateProfile — otherwise the profile
              // renders as an anonymous "User" with no email.
              setUser({
                id: authUser.uid,
                name: authUser.displayName || undefined,
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
