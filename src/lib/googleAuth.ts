import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
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

// Three separate OAuth clients are required in the Google Cloud Console:
// - Web client:     used by Firebase itself and by the browser popup flow.
// - Android client: application type "Android", package name `com.shipmatrix.app`,
//                   registered with the signing SHA-1 of the build you install.
// - iOS client:     application type "iOS", bundle id `com.shipmatrix.app`.
//
// The native clients cannot be exercised from Expo Go: Expo Go owns the `exp://`
// scheme, so the OAuth redirect comes back to Expo Go's launcher instead of this
// app. Native Google sign-in requires a development build.
//
// Find these under Google Cloud Console > project-191165632248 > APIs & Services
// > Credentials. Enabling the Google provider in Firebase Auth auto-creates the
// web client; the Android and iOS ones you add yourself.
const GOOGLE_WEB_CLIENT_ID =
  '191165632248-7r60afl92omlfo8gogn4s4bq0v72o8ri.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

export type GoogleSignInResult = {
  success: boolean;
  isNewUser?: boolean;
  error?: string;
};

function nativeClientIdMissing(): boolean {
  const id = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;
  return id.startsWith('YOUR_');
}

/**
 * Create the user's Firestore document on first sign-in.
 * Returns true when a new document was written.
 */
async function handleUserProvisioning(user: any): Promise<boolean> {
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

/** Exchange a Google ID token for a Firebase session and provision the user. */
async function completeFirebaseSignIn(
  idToken: string,
  accessToken?: string
): Promise<GoogleSignInResult> {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const userCred = await signInWithCredential(auth, credential);
  const isNewUser = await handleUserProvisioning(userCred.user);
  toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
  return { success: true, isNewUser };
}

/** Browser popup flow. Firebase handles the redirect via its own auth handler. */
async function signInWithGoogleWeb(): Promise<GoogleSignInResult> {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  const userCred = await signInWithPopup(auth, provider);
  const isNewUser = await handleUserProvisioning(userCred.user);
  toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
  return { success: true, isNewUser };
}

/**
 * Google sign-in for both web and native.
 *
 * On native this runs the authorization-code flow with PKCE: `useAuthRequest`
 * selects the platform's native client id, redirects to
 * `com.shipmatrix.app:/oauthredirect`, and exchanges the code for tokens
 * automatically — no client secret and no implicit grant involved.
 */
export function useGoogleSignIn() {
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  const signIn = useCallback(async (): Promise<GoogleSignInResult> => {
    try {
      if (Platform.OS === 'web') {
        return await signInWithGoogleWeb();
      }

      if (nativeClientIdMissing()) {
        const message =
          `Google sign-in is not configured for ${Platform.OS}. ` +
          'Add the native OAuth client id in src/lib/googleAuth.ts.';
        toast.error('Google Sign-In Unavailable', message);
        return { success: false, error: message };
      }

      // `request` is null until the PKCE challenge has been generated.
      if (!request) {
        return { success: false, error: 'Google sign-in is still starting up. Try again.' };
      }

      const result = await promptAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { success: false, error: 'Sign in cancelled' };
      }
      if (result.type !== 'success') {
        return { success: false, error: 'Authentication could not be completed.' };
      }

      // With auto code exchange the tokens arrive on `authentication`.
      const idToken = result.authentication?.idToken ?? (result.params?.id_token as string);
      const accessToken = result.authentication?.accessToken ?? (result.params?.access_token as string);

      if (!idToken) {
        return { success: false, error: 'Google did not return an ID token.' };
      }

      return await completeFirebaseSignIn(idToken, accessToken);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign in cancelled' };
      }
      const message = err?.message || 'Google sign-in failed';
      toast.error('Google Sign-In Error', message);
      return { success: false, error: message };
    }
  }, [request, promptAsync]);

  // Web needs no prepared request; native waits on the PKCE challenge.
  return { signIn, isReady: Platform.OS === 'web' || !!request };
}
