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

// `react-native-cashfree-pg-sdk` has no web build and breaks the web bundle if
// it is referenced at all, so the web entry point never touches it. Checkout on
// web should go through Cashfree's browser SDK or a hosted payment link.

export const isCashfreeAvailable = () => false;

export function openCashfreeCheckout(
  _options: CashfreeCheckoutOptions
): Promise<CashfreeCheckoutResult> {
  return Promise.reject(
    new CashfreeError('Card payments are not supported in the web preview. Please use the mobile app.')
  );
}
