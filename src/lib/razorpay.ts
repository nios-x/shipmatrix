import { Platform } from 'react-native';

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * `react-native-razorpay` is a native module: it is absent in Expo Go and on
 * web. Resolving it lazily keeps those environments from crashing at import
 * time, so the wallet screen still renders and can explain why checkout is
 * unavailable.
 */
function loadCheckout(): { open(options: RazorpayOptions): Promise<RazorpaySuccess> } | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-razorpay');
    const checkout = mod?.default ?? mod;
    return typeof checkout?.open === 'function' ? checkout : null;
  } catch {
    return null;
  }
}

export const isRazorpayAvailable = () => loadCheckout() !== null;

const UNAVAILABLE_MESSAGE =
  Platform.OS === 'web'
    ? 'Card payments are not supported in the web preview. Please use the mobile app.'
    : 'Payments require the full app build. Reinstall the latest build from your app store.';

const RazorpayCheckout = {
  async open(options: RazorpayOptions): Promise<RazorpaySuccess> {
    const checkout = loadCheckout();
    if (!checkout) throw new Error(UNAVAILABLE_MESSAGE);
    return checkout.open(options);
  },
};

export default RazorpayCheckout;
