import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import type { Shipment } from '../types';

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setShipments([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, `users/${user.uid}/shipments`),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Shipment)
          );
          setShipments(data);
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${user.uid}/shipments`
          );
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, []);

  return { shipments, loading };
}
