import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import { setUser, setLoading, logout } from '../store/authSlice';
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

export default function RootNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.auth
  );

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
              dispatch(
                setUser({ id: docSnap.id, ...docSnap.data() } as User)
              );
            } else {
              // User exists in Auth but not Firestore → needs signup completion
              dispatch(
                setUser({
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || undefined,
                  email: firebaseUser.email || undefined,
                  role: 'user',
                  walletBalance: 0,
                  needsOnboarding: true,
                })
              );
            }
          },
          () => {
            dispatch(setLoading(false));
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
