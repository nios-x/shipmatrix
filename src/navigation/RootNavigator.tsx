import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as AuthUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { backfillIdentity, repairMissingProfile } from '../lib/userProfile';
import { toast } from '../lib/alert';
import { setUser, logout } from '../store/authSlice';
import type { RootState } from '../store';
import type { RootStackParamList } from './types';
import type { User } from '../types';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

import { View, ActivityIndicator } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
      }}
    >
      <ActivityIndicator size="large" color="#7c3aed" />
    </View>
  );
}

/**
 * What we know about a signed-in user from the Auth record alone.
 *
 * Used whenever the profile document cannot be read — it is missing, or the
 * read was refused. Signing the user out in either case would be wrong: they
 * hold a valid session, and Firebase is the authority on that, not Firestore.
 */
function profileFromAuth(firebaseUser: AuthUser): User {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || undefined,
    email: firebaseUser.email || undefined,
    role: 'user',
    walletBalance: 0,
  };
}

export default function RootNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.auth
  );

  // The app's only auth subscription. Screens read the result through
  // `useUser()`, which selects from the store — they do not open listeners of
  // their own, so `users/{uid}` is watched once no matter how many are mounted.
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        // Listen to Firestore user document for real-time updates
        unsubscribeSnapshot = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              dispatch(setUser({ id: docSnap.id, ...data } as User));
              void backfillIdentity(firebaseUser, data);
            } else {
              // Signed in with no profile behind it. Google sign-in swallows a
              // failed provisioning write rather than failing a sign-in that
              // actually succeeded, so retry it here — the write is the same
              // one that path makes, and a success arrives back through this
              // very listener as the real document.
              dispatch(setUser(profileFromAuth(firebaseUser)));
              void repairMissingProfile(firebaseUser);
            }
          },
          (error) => {
            // A read failure is not a sign-out. Dropping to an unauthenticated
            // state here swapped the whole stack back to Login while
            // `auth.currentUser` was still set, with nothing said and nothing
            // to retry — Firestore tears this listener down after an error.
            // Keep the session on what Auth already told us.
            handleFirestoreError(
              error,
              OperationType.GET,
              `users/${firebaseUser.uid}`
            );
            dispatch(setUser(profileFromAuth(firebaseUser)));
            // Say so, because the stand-in carries a zero balance and no
            // company. Letting that render unannounced would report a wallet as
            // empty when the truth is that we could not read it.
            toast.error(
              'Profile unavailable',
              'Signed in, but your profile could not be loaded. Balances and company details may be missing until you reopen the app.'
            );
          }
        );
      } else {
        dispatch(logout());
      }
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, [dispatch]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoading ? (
          <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
