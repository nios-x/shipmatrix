import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Google from 'expo-auth-session/providers/google';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { toast } from './alert';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '563260211850-8g6o316bsp25nsvo14m4d42m662t4khv.apps.googleusercontent.com';

/**
 * Handle user provisioning in Firestore after successful Google Auth
 */
/**
 * Perform Google Sign-In across Web and Mobile Native.
 */
export async function signInWithGoogle(): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      const userCred = await signInWithPopup(auth, provider);
      if (!userCred || !userCred.user) {
        return { success: false, error: 'No user credential returned' };
      }

      const isNewUser = await handleUserProvisioning(userCred.user);
      toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
      return { success: true, isNewUser };
    }

    // Native Mobile (Android / iOS)
    const redirectUrl = Linking.createURL('auth');

    // Standard Google OAuth 2.0 Authorize Endpoint
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&response_type=token%20id_token` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&nonce=${Math.random().toString(36).slice(2)}` +
      `&prompt=select_account`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type === 'success' && result.url) {
      const parsedUrl = result.url.replace('#', '?');
      const queryParams = Linking.parse(parsedUrl).queryParams || {};

      const idToken = (queryParams.id_token || queryParams.idToken) as string;
      const accessToken = (queryParams.access_token || queryParams.accessToken) as string;

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCred = await signInWithCredential(auth, credential);
        const isNewUser = await handleUserProvisioning(userCred.user);
        toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
        return { success: true, isNewUser };
      }
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Sign in cancelled' };
    }

    return { success: false, error: 'Authentication could not be completed.' };
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign in cancelled' };
    }
    const message = err.message || 'Google sign-in failed';
    toast.error('Google Sign-In Error', message);
    return { success: false, error: message };
  }
}


WebBrowser.maybeCompleteAuthSession();

// You need THREE separate client IDs from Google Cloud Console:
// - a Web client ID (used by Firebase itself + as the base clientId below)
// - an Android client ID (Application type: Android, with your SHA-1 fingerprint)
// - an iOS client ID (Application type: iOS, with your bundle id)
const GOOGLE_WEB_CLIENT_ID = '563260211850-8g6o316bsp25nsvo14m4d42m662t4khv.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

async function handleUserProvisioning(user: any): Promise<boolean> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  let isNewUser = false;
  if (!userSnap.exists()) {
    isNewUser = true;
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

  return isNewUser;
}

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });

  return { request, response, promptAsync };
}

export async function completeGoogleSignIn(response: any): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> {
  try {
    if (response?.type !== 'success') {
      return { success: false, error: 'Sign in cancelled' };
    }

    const { id_token, access_token } = response.params;
    const credential = GoogleAuthProvider.credential(id_token, access_token);
    const userCred = await signInWithCredential(auth, credential);
    const isNewUser = await handleUserProvisioning(userCred.user);
    toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
    return { success: true, isNewUser };
  } catch (err: any) {
    const message = err.message || 'Google sign-in failed';
    toast.error('Google Sign-In Error', message);
    return { success: false, error: message };
  }
}

export async function signInWithGoogleWeb(): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    const userCred = await signInWithPopup(auth, provider);
    const isNewUser = await handleUserProvisioning(userCred.user);
    toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
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