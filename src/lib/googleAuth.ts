import { useCallback } from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { exchangeCodeAsync } from 'expo-auth-session';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebase';
import { ensureUserProfile } from './userProfile';
import { toast } from './alert';

WebBrowser.maybeCompleteAuthSession();

// Three separate OAuth clients are required in the Google Cloud Console:
// - Web client:     used by Firebase itself and by the browser popup flow.
// - Android client: application type "Android", package name `com.shipmatrix.app`,
//                   registered with the signing SHA-1 of the build you install.
// - iOS client:     application type "iOS", bundle id `com.shipmatrix.app`.
//
// The native clients are not interchangeable with the web one. Google rejects a
// web client id presented with this app's `com.shipmatrix.app:/oauthredirect`
// redirect outright:
//   invalid_request — Custom scheme URIs are not allowed for 'WEB' client type.
// So there is no "just reuse the web id" shortcut on Android or iOS.
//
// The Android client additionally needs "Custom URI scheme" enabled under its
// Advanced Settings. Google creates new native clients with it OFF, and answers
// this flow with:
//   invalid_request — Custom URI scheme is not enabled for your Android client.
// Note it fails that request by *rendering an error page* rather than
// redirecting, so `promptAsync` never sees an error — the user closes the tab
// and the result arrives here as a plain `dismiss`. Diagnose it by hand:
//   curl -s -o /dev/null -w '%{redirect_url}' \
//     "https://accounts.google.com/o/oauth2/v2/auth?client_id=$ID\
// &redirect_uri=com.shipmatrix.app%3A%2Foauthredirect&response_type=code\
// &scope=openid&code_challenge=x&code_challenge_method=S256"
// and base64-decode the `authError` parameter it comes back with.
//
// The native clients also cannot be exercised from Expo Go: Expo Go owns the
// `exp://` scheme, so `useAuthRequest` builds an `exp://<lan-ip>:8081` redirect
// and the OAuth response comes back to Expo Go's launcher instead of this app.
// What reaches us is the bare launch URL with its query string gone, so
// `expo-auth-session` finds no `state` to match and reports:
//   state_mismatch — Cached state and returned state do not match.
// That error names neither Expo Go nor the redirect, so `isRunningInExpoGo()`
// gates the button below instead of letting it fail that way. Native Google
// sign-in requires a development build (`npx expo run:android`).
//
// Find these under Google Cloud Console > project-191165632248 > APIs & Services
// > Credentials. Enabling the Google provider in Firebase Auth auto-creates the
// web client; the Android and iOS ones you add yourself.
//
// Debug builds are signed with android/app/debug.keystore, so the Android client
// must carry that keystore's SHA-1:
//   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
// A release build signed with a different keystore needs its own SHA-1 added too.
//
// OAuth client ids are public values, so they live in .env rather than here.
// Note that `EXPO_PUBLIC_*` values are inlined into the bundle at build time:
// after editing .env you must restart Metro with `--clear`, or the previous
// value stays baked into the running bundle.
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '191165632248-7r60afl92omlfo8gogn4s4bq0v72o8ri.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

/** The OAuth client this platform signs in with; '' when none is configured. */
const nativeClientId =
  Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;

/** Expo Go cannot receive this app's OAuth redirect; see the note above. */
const isExpoGo = isRunningInExpoGo();

/**
 * Whether Google sign-in can actually complete on this platform.
 *
 * Screens hide "Continue with Google" when this is false: without a native OAuth
 * client the button can only ever fail, and a dead primary CTA is worse than no
 * CTA at all.
 */
export const isGoogleSignInConfigured =
  Platform.OS === 'web' ? !!GOOGLE_WEB_CLIENT_ID : !!nativeClientId && !isExpoGo;

// A missing native client id is otherwise a silent failure: the button simply
// never renders, which on screen is indistinguishable from a layout bug. Say it
// once at startup so it lands in `adb logcat -s ReactNativeJS`.
if (__DEV__ && !isGoogleSignInConfigured && Platform.OS !== 'web') {
  if (isExpoGo) {
    console.warn(
      '[googleAuth] "Continue with Google" is hidden: Expo Go cannot complete this flow. ' +
        "It owns the exp:// scheme, so Google's response goes to Expo Go's launcher and comes " +
        'back stripped of its state parameter. Run a development build instead: npx expo run:android.'
    );
  } else {
    const missingVar =
      Platform.OS === 'ios'
        ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
        : 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID';
    console.warn(
      `[googleAuth] "Continue with Google" is hidden on ${Platform.OS}: ${missingVar} is not set. ` +
        'Create an OAuth client of that platform type in Google Cloud Console (package/bundle id ' +
        'com.shipmatrix.app), put the id in .env, then restart Metro with --clear.'
    );
  }
}

export type GoogleSignInResult = {
  success: boolean;
  isNewUser?: boolean;
  error?: string;
};

/**
 * Turn an OAuth failure into something a human can act on.
 *
 * Google reports these as short machine codes (`redirect_uri_mismatch`,
 * `invalid_client`, ...) whose fix lives entirely in the Cloud Console.
 * Collapsing them all into one generic string — as this used to — makes a
 * misconfigured client indistinguishable from a network blip.
 */
function describeAuthError(code?: string | null, description?: string | null): string {
  switch (code) {
    case 'redirect_uri_mismatch':
      return "Google rejected this app's redirect URI. The Android OAuth client must use package name com.shipmatrix.app and the SHA-1 of the keystore this build is signed with.";
    case 'invalid_request':
      // Google creates new Android/iOS clients with custom URI schemes turned
      // OFF, which rejects this flow's `com.shipmatrix.app:/oauthredirect`
      // before the browser ever redirects back. Enable it under the client's
      // Advanced Settings, or move to the Play Services SDK.
      return 'This app\'s Google client does not allow its sign-in redirect. Enable "Custom URI scheme" on the Android OAuth client in Google Cloud Console.';
    case 'invalid_client':
    case 'unauthorized_client':
      return 'Google does not recognise this OAuth client id. Check EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in .env.';
    case 'state_mismatch':
      // The response came back without the state we sent, so the redirect never
      // reached this app intact. In practice that means Expo Go swallowed it —
      // which the button gate above now prevents — or a stale tab from an
      // earlier attempt answered instead of the current one.
      return 'The Google sign-in response did not come back to this app. Close any leftover sign-in tab and try again; in Expo Go this flow cannot complete at all.';
    case 'invalid_grant':
      return 'That sign-in attempt expired before it completed. Please try again.';
    case 'access_denied':
      return 'Sign in was denied. If the OAuth consent screen is still in "Testing", your Google account has to be listed as a test user.';
    case 'admin_policy_enforced':
      return 'Your Google Workspace administrator has blocked sign-in to this app.';
    default:
      return description || code || 'Authentication could not be completed.';
  }
}

/** Exchange a Google ID token for a Firebase session and provision the user. */
async function completeFirebaseSignIn(
  idToken: string
): Promise<GoogleSignInResult> {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);

  // Past this line the user *is* signed in and the auth listener has already
  // started routing them into the app. A Firestore hiccup while writing the
  // profile must not be reported as a failed sign-in — that would put an error
  // over a screen that is busy succeeding.
  let isNewUser: boolean | undefined;
  try {
    isNewUser = await ensureUserProfile(userCred.user);
  } catch (err) {
    console.warn('[googleAuth] signed in, but writing the user document failed', err);
  }

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
  let isNewUser: boolean | undefined;
  try {
    isNewUser = await ensureUserProfile(userCred.user);
  } catch (err) {
    console.warn('[googleAuth] signed in, but writing the user document failed', err);
  }
  toast.success('Welcome!', `Signed in as ${userCred.user.displayName || userCred.user.email}`);
  return { success: true, isNewUser };
}

/**
 * Google sign-in for both web and native.
 *
 * On native this runs the authorization-code flow with PKCE: `useAuthRequest`
 * selects the platform's native client id and redirects to
 * `com.shipmatrix.app:/oauthredirect` — no client secret and no implicit
 * grant involved. We trade the returned code for tokens ourselves; see below.
 */
export function useGoogleSignIn() {
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // `useAuthRequest` throws outright when the current platform's client id is
    // empty, which would take the whole login screen down. These placeholders
    // exist only to keep the hook constructible; `signIn` refuses to prompt
    // unless `isGoogleSignInConfigured`, so neither is ever sent to Google.
    //
    // They must not fall back to the web id. Google answers a web client
    // presented with a custom-scheme redirect with a flat
    // "invalid_request — Custom scheme URIs are not allowed for 'WEB' client
    // type", which reads like a code bug instead of the missing-configuration
    // problem it actually is.
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || 'unconfigured.apps.googleusercontent.com',
    iosClientId: GOOGLE_IOS_CLIENT_ID || 'unconfigured.apps.googleusercontent.com',
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
    // The hook can exchange the code itself, but it resolves that exchange into
    // its `response` value one render *after* `promptAsync()` settles, and the
    // authorization code is single-use. Opt out so the exchange below owns it.
    shouldAutoExchangeCode: false,
  });

  const signIn = useCallback(async (): Promise<GoogleSignInResult> => {
    try {
      if (Platform.OS === 'web') {
        return await signInWithGoogleWeb();
      }

      if (!isGoogleSignInConfigured) {
        // Screens hide the button in this state, so getting here means something
        // called sign-in directly. The copy stays user-facing: an end user can do
        // nothing with a source path, and shipping one to them is a leak.
        const message =
          'Google sign-in is unavailable right now. Please sign in with your email and password.';
        toast.error('Google Sign-In Unavailable', message);
        return { success: false, error: message };
      }

      // `request` is null until the PKCE challenge has been generated.
      if (!request) {
        return { success: false, error: 'Google sign-in is still starting up. Try again.' };
      }

      if (__DEV__) {
        // The two values every native OAuth failure comes down to. Having them
        // in logcat turns "it doesn't work" into a one-line comparison against
        // the Cloud Console entry.
        console.log(
          `[googleAuth] authorizing clientId=${request.clientId} redirectUri=${request.redirectUri}`
        );
      }

      const result = await promptAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { success: false, error: 'Sign in cancelled' };
      }
      if (result.type !== 'success') {
        // `error` is populated for `type: 'error'`; Google also mirrors the code
        // into the query string, so fall back to that before giving up. Without
        // this the console-side causes all surface as one opaque sentence.
        const raw = result as any;
        const code =
          (typeof raw.error === 'string' ? raw.error : raw.error?.code) ??
          raw.params?.error ??
          raw.errorCode;
        if (__DEV__) {
          console.warn('[googleAuth] authorization failed', JSON.stringify(raw));
        }
        return {
          success: false,
          error: describeAuthError(
            typeof code === 'string' ? code : null,
            raw.params?.error_description
          ),
        };
      }

      // The native flow resolves with an authorization code, never with tokens.
      // Trade it for an ID token using the exact client id, redirect uri and PKCE
      // verifier this request was built with — Google rejects any mismatch.
      const code = result.params?.code;
      if (!code) {
        return { success: false, error: 'Google did not return an authorization code.' };
      }

      let tokens;
      try {
        tokens = await exchangeCodeAsync(
          {
            clientId: request.clientId,
            redirectUri: request.redirectUri,
            scopes: request.scopes,
            code,
            extraParams: { code_verifier: request.codeVerifier ?? '' },
          },
          Google.discovery
        );
      } catch (err: any) {
        // A failure here is a token-endpoint rejection rather than anything the
        // user did: `invalid_grant` (code already spent or expired), or a
        // client/redirect mismatch. Name it instead of letting it fall through
        // to the catch-all as a raw SDK message.
        if (__DEV__) {
          console.warn('[googleAuth] code exchange failed', err?.code, err?.message);
        }
        return {
          success: false,
          error: describeAuthError(err?.code, err?.description || err?.message),
        };
      }

      if (!tokens.idToken) {
        return { success: false, error: 'Google did not return an ID token.' };
      }

      return await completeFirebaseSignIn(tokens.idToken);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign in cancelled' };
      }
      if (err?.code === 'auth/unauthorized-domain') {
        const message =
          'Google sign-in is not enabled for this website. Add new-shipmatrix.vercel.app in Firebase Console > Authentication > Settings > Authorized domains.';
        toast.error('Google Sign-In Unavailable', message);
        return { success: false, error: message };
      }
      const message = err?.message || 'Google sign-in failed';
      toast.error('Google Sign-In Error', message);
      return { success: false, error: message };
    }
  }, [request, promptAsync]);

  // Web needs no prepared request; native waits on the PKCE challenge.
  return { signIn, isReady: Platform.OS === 'web' || !!request };
}
