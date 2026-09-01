import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { User } from '../types';

/**
 * The signed-in user's profile.
 *
 * This is a read of the store, not a subscription of its own. It used to open
 * its own `onAuthStateChanged` plus an `onSnapshot` on `users/{uid}` per call
 * site, and a dozen screens call it — so a single dashboard held a dozen live
 * listeners on one document, and the identity backfill fired from every one of
 * them at once as a pile of identical concurrent writes. RootNavigator owns the
 * one listener now and writes what it sees into the store.
 *
 * The shape is unchanged (`{ user, loading }`) so call sites did not have to move.
 */
export function useUser(): { user: User | null; loading: boolean } {
  // Two selectors rather than one returning `{ user, loading }`: react-redux
  // compares results by reference, so a fresh object would re-render every
  // consumer on every dispatched action, wallet and shipments included.
  const user = useSelector((state: RootState) => state.auth.user);
  const loading = useSelector((state: RootState) => state.auth.isLoading);

  return { user, loading };
}
