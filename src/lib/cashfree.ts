import {
  CashfreeError,
  type CashfreeCheckoutOptions,
  type CashfreeCheckoutResult,
} from './cashfree-types';

export {
  CashfreeError,
  type CashfreeEnvironment,
  type CashfreeCheckoutOptions,
  type CashfreeCheckoutResult,
} from './cashfree-types';

/**
 * The Cashfree SDK is a native module: it is absent in Expo Go. Resolving it
 * lazily keeps that environment from crashing at import time, so the wallet
 * screen still renders and can explain why checkout is unavailable.
 *
 * Web never reaches this file — `cashfree.web.ts` shadows it, because the SDK
 * cannot be bundled for web at all.
 */
function loadSdk(): { service: any; contract: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require('react-native-cashfree-pg-sdk');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const contract = require('cashfree-pg-api-contract');
    if (typeof service?.CFPaymentGatewayService?.doPayment !== 'function') return null;
    return { service, contract };
  } catch {
    return null;
  }
}

export const isCashfreeAvailable = () => loadSdk() !== null;

const UNAVAILABLE_MESSAGE =
  'Payments require the full app build (Cashfree is a native module and cannot run in Expo Go).';

/** Normalise the SDK's error object, which may be a class instance or a plain object. */
function toCashfreeError(raw: any): CashfreeError {
  const read = (getter: string, prop: string) =>
    typeof raw?.[getter] === 'function' ? raw[getter]() : raw?.[prop];

  const message = read('getMessage', 'message') || 'Payment failed';
  const code = read('getCode', 'code');
  const status = read('getStatus', 'status');
  const type = read('getType', 'type');

  const cancelled = /cancel|abort|user.?dropped/i.test(`${message} ${status ?? ''} ${type ?? ''}`);

  return new CashfreeError(String(message), {
    code: code != null ? String(code) : undefined,
    status: status != null ? String(status) : undefined,
    type: type != null ? String(type) : undefined,
    cancelled,
  });
}

/**
 * Open Cashfree's hosted web checkout and resolve once the SDK reports back.
 *
 * `doPayment` is fire-and-forget — the outcome arrives on the callback — so the
 * callback is registered immediately before the call and torn down as soon as
 * the promise settles, which keeps concurrent checkouts from crossing wires.
 *
 * Resolving only means the flow finished. The payment itself must still be
 * confirmed server-side via the Cashfree order status API.
 */
export function openCashfreeCheckout(
  options: CashfreeCheckoutOptions
): Promise<CashfreeCheckoutResult> {
  const sdk = loadSdk();
  if (!sdk) return Promise.reject(new CashfreeError(UNAVAILABLE_MESSAGE));

  const { CFPaymentGatewayService } = sdk.service;
  const { CFSession, CFEnvironment, CFWebCheckoutPayment, CFWebThemeBuilder } = sdk.contract;

  return new Promise<CashfreeCheckoutResult>((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        CFPaymentGatewayService.removeCallback();
      } catch {
        // Tearing down the callback must never mask the payment outcome.
      }
      fn();
    };

    try {
      CFPaymentGatewayService.setCallback({
        onVerify: (orderID: string) =>
          finish(() => resolve({ orderId: orderID || options.orderId })),
        onError: (error: any, orderID: string) => {
          const err = toCashfreeError(error);
          finish(() => reject(Object.assign(err, { orderId: orderID || options.orderId })));
        },
      });

      const session = new CFSession(
        options.paymentSessionId,
        options.orderId,
        options.environment === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX
      );

      const theme = new CFWebThemeBuilder()
        .setNavigationBarBackgroundColor('#7C3AED')
        .setNavigationBarTextColor('#FFFFFF')
        .build();

      CFPaymentGatewayService.doPayment(new CFWebCheckoutPayment(session, theme));
    } catch (e: any) {
      finish(() => reject(toCashfreeError(e)));
    }
  });
}
