import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firebase-utils';
import type { Notification } from '../types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, `users/${user.uid}/notifications`),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          setNotifications(
            snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
          );
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/notifications`, id), { read: true });
    } catch {
      // Non-critical: the listener keeps the UI correct either way.
    }
  };

  const markAllAsRead = async () => {
    if (!auth.currentUser) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, `users/${auth.currentUser!.uid}/notifications`, n.id), { read: true });
      });
      await batch.commit();
    } catch {
      // Non-critical.
    }
  };

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead };
}
