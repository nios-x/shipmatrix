import { api, PAYMENTS_BASE_URL } from './api';

/**
 * Email one-time codes, served by the ShipMatrix payments server.
 *
 * These calls run before the account exists, so they are deliberately
 * unauthenticated — `skipAuth` stops the api helper from waiting on a Firebase
 * token that is not there yet.
 */
export type OtpPurpose = 'signup' | 'login' | 'password_reset';

export interface SendOtpResult {
  /** ISO timestamp after which the code stops working. */
  expiresAt: string;
  /** Seconds the user must wait before asking for another code. */
  resendAfterSeconds: number;
}

export async function sendOtp(email: string, purpose: OtpPurpose = 'signup'): Promise<SendOtpResult> {
  const res = await api.post(
    `${PAYMENTS_BASE_URL}/api/otp/send`,
    { email: email.trim(), purpose },
    { skipAuth: true }
  );

  return {
    expiresAt: res.expires_at,
    resendAfterSeconds: Number(res.resend_after_seconds ?? 60),
  };
}

export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = 'signup'
): Promise<void> {
  await api.post(
    `${PAYMENTS_BASE_URL}/api/otp/verify`,
    { email: email.trim(), code: code.trim(), purpose },
    { skipAuth: true }
  );
}

/** The signup form's fields, as the register endpoint expects them. */
export interface RegistrationDetails {
  email: string;
  code: string;
  password: string;
  name: string;
  phone?: string;
  companyName?: string;
  gstNo?: string;
  noOfOrders?: string;
  companyType?: string;
}

/**
 * Verifies the emailed code and creates the account in one server call,
 * resolving with a custom token to sign in with.
 *
 * Signup used to verify the code here and then call
 * `createUserWithEmailAndPassword` directly, with nothing tying the two
 * together — the Firebase web API key ships inside the bundle, so anyone could
 * skip the verify call and register an address they did not own. Doing both on
 * the server is what makes the code a gate rather than a formality.
 *
 * The profile document is written there too, which is why this no longer needs
 * `role` or `walletBalance`: the Firestore rules refuse them from a client, and
 * the server seeds both.
 */
export async function registerWithOtp(details: RegistrationDetails): Promise<string> {
  const res = await api.post(
    `${PAYMENTS_BASE_URL}/api/otp/register`,
    {
      email: details.email.trim(),
      code: details.code.trim(),
      password: details.password,
      name: details.name.trim(),
      phone: details.phone?.trim(),
      companyName: details.companyName?.trim(),
      gstNo: details.gstNo?.trim(),
      noOfOrders: details.noOfOrders,
      companyType: details.companyType,
    },
    { skipAuth: true }
  );

  if (!res.custom_token) {
    throw new Error('The server did not return a sign-in token. Please try signing in.');
  }

  return res.custom_token as string;
}
