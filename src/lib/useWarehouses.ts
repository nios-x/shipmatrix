import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import { useUser } from './useUser';
import type { WarehouseData } from '../types';

const path = (uid: string) => `users/${uid}/warehouses`;

/**
 * Whether two entries are the same warehouse. Ids decide when both have one;
 * the profile's `warehouseData` predates the list and may not, so name and
 * pincode decide then — the same test the web app uses to mark its selection.
 */
export function sameWarehouse(a?: WarehouseData | null, b?: WarehouseData | null): boolean {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  return a.name === b.name && a.pincode === b.pincode;
}

/** The stored fields, without the id that names the document. */
function fields(w: WarehouseData): Omit<WarehouseData, 'id'> {
  const { id: _id, ...rest } = w;
  return rest;
}

/**
 * Id for a warehouse copied into the list from a pre-list profile. Derived
 * from the warehouse, so two screens copying it at once write one document.
 */
function profileCopyId(w: WarehouseData): string {
  const slug = w.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  return `profile-${w.pincode}-${slug}`;
}

/**
 * The user's saved pickup warehouses, live, plus the default one.
 *
 * A profile set up before the list existed has its warehouse only in
 * `warehouseData`. That copy is the sole record of it, and choosing another
 * default — here or on the website — overwrites it, so the warehouse is copied
 * into the list the first time it is seen and the profile copy is stamped with
 * its id. It is shown first in the meantime.
 */
export function useWarehouses() {
  const { user } = useUser();
  const uid = user?.id;
  // Tagged with the account it was read for, so a sign-in switch shows nothing
  // rather than the previous account's list until the new snapshot lands.
  const [snap, setSnap] = useState<{ uid: string; list: WarehouseData[] } | null>(null);
  const current = snap && snap.uid === uid ? snap : null;
  const saved = current?.list ?? [];
  const loading = !!uid && !current;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, path(uid)),
      (snapshot) => {
        setSnap({
          uid,
          list: snapshot.docs.map((d) => ({ ...(d.data() as WarehouseData), id: d.id })),
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path(uid));
        setSnap({ uid, list: [] });
      }
    );
  }, [uid]);

  const profileCopy = user?.warehouseData?.name ? user.warehouseData : null;
  const unlisted = !!profileCopy && !saved.some((w) => sameWarehouse(w, profileCopy));
  const warehouses = unlisted ? [profileCopy, ...saved] : saved;

  // Only once the list has loaded, or a warehouse already in it would be
  // copied again. A copy with an id was in the list and has been deleted
  // since; that one is left alone.
  const toCopy = current && unlisted && !profileCopy.id ? profileCopy : null;
  useEffect(() => {
    if (!uid || !toCopy) return;
    const id = profileCopyId(toCopy);
    setDoc(doc(db, path(uid), id), fields(toCopy), { merge: true })
      .then(() => updateDoc(doc(db, 'users', uid), { warehouseData: { ...fields(toCopy), id } }))
      .catch((error) => handleFirestoreError(error, OperationType.WRITE, path(uid)));
  }, [uid, toCopy]);
  const defaultWarehouse =
    warehouses.find((w) => sameWarehouse(w, profileCopy)) ?? warehouses[0] ?? null;

  return { warehouses, defaultWarehouse, loading };
}

/**
 * The saved warehouses plus which one this booking ships from — the default
 * until the user picks another. The pick is resolved against the live list so
 * an edit made elsewhere shows up, and is kept as-is for the moment between
 * saving a new warehouse and the snapshot that brings it into the list.
 */
export function useWarehouseSelection() {
  const store = useWarehouses();
  const [picked, setPicked] = useState<WarehouseData | null>(null);
  const selected =
    store.warehouses.find((w) => sameWarehouse(w, picked)) ?? picked ?? store.defaultWarehouse;
  return { ...store, selected, select: setPicked };
}

/** Makes `w` the warehouse new bookings start from. */
export async function setDefaultWarehouse(w: WarehouseData): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await updateDoc(doc(db, 'users', uid), { warehouseData: w });
}

/**
 * Creates or updates a warehouse and returns it with its id.
 *
 * `makeDefault` also rewrites the profile copy: callers pass it when there is
 * no default yet, or when the warehouse being edited was the default, so the
 * edit reaches the next booking.
 */
export async function saveWarehouse(
  w: WarehouseData,
  makeDefault: boolean
): Promise<WarehouseData> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  let id = w.id;
  if (id) {
    await setDoc(doc(db, path(uid), id), fields(w), { merge: true });
  } else {
    id = (await addDoc(collection(db, path(uid)), fields(w))).id;
  }

  const stored = { ...fields(w), id };
  if (makeDefault) await setDefaultWarehouse(stored);
  return stored;
}

/**
 * Removes a warehouse. When it was the default, the next remaining one takes
 * over, or the profile copy is cleared if none is left.
 */
export async function deleteWarehouse(
  w: WarehouseData,
  all: WarehouseData[],
  currentDefault: WarehouseData | null
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  if (w.id) await deleteDoc(doc(db, path(uid), w.id));

  if (sameWarehouse(currentDefault, w)) {
    const next = all.find((other) => !sameWarehouse(other, w));
    await updateDoc(doc(db, 'users', uid), { warehouseData: next ?? deleteField() });
  }
}
