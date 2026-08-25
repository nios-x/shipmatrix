import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import type { Transaction } from '../types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, `users/${user.uid}/transactions`),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Transaction)
          );
          setTransactions(data);
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${user.uid}/transactions`
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

  return { transactions, loading };
}
