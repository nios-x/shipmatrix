import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { User as AuthUser } from 'firebase/auth';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';

/**
 * The `users/{uid}` document, as written from a client.
 *
 * Email/password signup never comes through here — the payments server writes
 * that profile so `role` and `walletBalance` are seeded where a client cannot
 * choose them. Google sign-in has no server leg, so this is the one client path
 * that creates a profile, and it is why the rules have to accept a self-write
 * of these fields at all.
 */
export async function ensureUserProfile(user: AuthUser): Promise<boolean> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) return false;

  await setDoc(userRef, {
    name: user.displayName || user.email?.split('@')[0] || 'Google User',
    email: user.email || '',
    phone: user.phoneNumber || '',
    companyName: user.displayName ? `${user.displayName}'s Company` : 'My Business',
    gstNo: '',
    noOfOrders: '0-50',
    companyType: 'B2C',
    role: 'user',
    walletBalance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

/**
 * Re-run provisioning for a signed-in user whose profile document is missing.
 *
 * Google sign-in deliberately swallows a failed provisioning write rather than
 * reporting a successful sign-in as a failure, which leaves an account with no
 * profile behind it. Nothing used to retry, so that state was permanent; this
 * runs from the auth listener, so the next launch repairs it.
 */
export async function repairMissingProfile(user: AuthUser): Promise<void> {
  try {
    await ensureUserProfile(user);
  } catch (e) {
    // Best effort. The caller has already put a minimal profile on screen, so
    // the app stays usable either way.
    handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`);
  }
}

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
export async function backfillIdentity(
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
