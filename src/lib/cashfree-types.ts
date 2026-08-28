// Shared Cashfree types and error class.
//
// This file intentionally has NO platform suffix and never imports the native
// SDK. `cashfree.ts` (native) and `cashfree.web.ts` (web) both import it.
// The split exists because `react-native-cashfree-pg-sdk` cannot be bundled for
// web at all — a lazy `require()` is not enough, since Metro still resolves it
// statically.

export type CashfreeEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface CashfreeCheckoutOptions {
  /** `payment_session_id` returned by the server's Create Order call. */
  paymentSessionId: string;
  /** `order_id` returned by the server's Create Order call. */
  orderId: string;
  environment: CashfreeEnvironment;
}

export interface CashfreeCheckoutResult {
  /** The order to verify server-side. Never trust this alone as proof of payment. */
  orderId: string;
}

export class CashfreeError extends Error {
  code?: string;
  status?: string;
  type?: string;
  cancelled: boolean;

  constructor(
    message: string,
    opts: { code?: string; status?: string; type?: string; cancelled?: boolean } = {}
  ) {
    super(message);
    this.name = 'CashfreeError';
    this.code = opts.code;
    this.status = opts.status;
    this.type = opts.type;
    this.cancelled = opts.cancelled ?? false;
  }
}
