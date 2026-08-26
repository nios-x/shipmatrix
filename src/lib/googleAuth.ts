import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';
import { toast } from './alert';

/**
 * Perform Google Sign-In across platforms.
 * Creates a default Firestore user profile if this is a first-time sign-in.
 */
export async function signInWithGoogle(): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    let userCred: any;

    if (Platform.OS === 'web') {
      userCred = await signInWithPopup(auth, provider);
    } else {
      // For mobile native, attempt Firebase popup or web-auth flow
      try {
        userCred = await signInWithPopup(auth, provider);
      } catch (nativeErr: any) {
        if (nativeErr.code === 'auth/popup-blocked' || nativeErr.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return { success: true };
        }
        throw nativeErr;
      }
    }

    if (!userCred || !userCred.user) {
      return { success: false, error: 'No user credential returned' };
    }

    const user = userCred.user;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    let isNewUser = false;

    if (!userSnap.exists()) {
      isNewUser = true;
      // Auto-provision initial profile matching website format
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
    }

    toast.success('Welcome!', `Signed in as ${user.displayName || user.email}`);
    return { success: true, isNewUser };
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign in cancelled' };
    }
    const message = err.message || 'Google sign-in failed';
    toast.error('Google Sign-In Error', message);
    return { success: false, error: message };
  }
}
