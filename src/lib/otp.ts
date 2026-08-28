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
