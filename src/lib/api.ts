import { auth } from './firebase';

/** Trailing slashes would double up when a path is appended. */
const trim = (url: string) => url.replace(/\/+$/, '');

/**
 * The one deployment this app talks to.
 *
 * It used to be `https://www.shipmatrix.in`, hard-coded. That host now runs a
 * build that predates the services migration — its `/api/cashfree/*`,
 * `/api/otp/*` and `/api/shipments/*` routes do not exist — and it is not ours
 * to redeploy, so every privileged call to it answered 404 and the app surfaced
 * that as "Request failed with status 404" on the recharge screen.
 *
 * The default is therefore the fork we do control. `EXPO_PUBLIC_API_URL`
 * overrides it; Expo inlines `EXPO_PUBLIC_*` at bundle time, so a change needs
 * a rebuild, not just a restart.
 */
export const API_BASE_URL = trim(
  process.env.EXPO_PUBLIC_API_URL || 'https://new-shipmatrix.vercel.app'
);

/**
 * The privileged services: payments, OTP, rates, booking, and the channel
 * integrations — anything needing the Cashfree secret key or Firebase Admin.
 *
 * These ran as their own deployment (`shipmatrix-server`, on Render) and have
 * been migrated into the website, so this is the same host as `API_BASE_URL`
 * and defaults to it. The two constants are kept apart deliberately: the split
 * is about *privilege*, not about hosting, and the `routes` table below still
 * says which half of the backend answers each path. Should the privileged
 * services ever move back onto their own box, only this line changes.
 *
 * `EXPO_PUBLIC_PAYMENTS_URL` overrides it — point it at a server on your own
 * machine (e.g. `http://192.168.1.5:3000`) to develop against local changes.
 * Leave it unset and everything goes to the one deployment, which is what you
 * want unless you are actively debugging the backend. A plain-`http` override
 * only works in a debug build; release builds block cleartext traffic on
 * Android.
 */
export const SERVICES_BASE_URL = trim(
  process.env.EXPO_PUBLIC_PAYMENTS_URL || API_BASE_URL
);

/** An absolute URL on the services host. */
const svc = (path: string) => `${SERVICES_BASE_URL}${path}`;

/**
 * Every endpoint the app calls, and — by whether it is absolute — which half
 * of the backend serves it.
 *
 * This used to live at the call sites, each one remembering to prefix the
 * services base itself. Forgetting the prefix was silent: the path is relative,
 * so it resolved against the core API instead and 404d at runtime, with
 * nothing between the typo and production to catch it. The two sides also
 * carry near-identical paths — `/api/shipments/book` here,
 * `/api/v1/shipments/sync` on the core API — where the `/v1` reads like a
 * version but really marks which side answers. Naming the route makes both
 * traps unreachable.
 *
 * The two now resolve to the same host, so a missing prefix currently lands on
 * the right server by luck. That is exactly why the distinction is still
 * written down: `/api/rates` is served by *both* — the privileged, authenticated
 * quote the app books against, and the website's public rate calculator — and
 * only the bearer token this module attaches decides which one answers.
 */
export const routes = {
  // ── Services host ──────────────────────────────────────
  createOrder: svc('/api/cashfree/create-order'),
  verifyPayment: svc('/api/cashfree/verify'),

  otpSend: svc('/api/otp/send'),
  otpVerify: svc('/api/otp/verify'),
  otpRegister: svc('/api/otp/register'),

  rates: svc('/api/rates'),
  bookShipment: svc('/api/shipments/book'),
  cancelShipment: svc('/api/shipments/cancel'),

  connectShopify: svc('/api/integrations/shopify/connect'),
  connectWooCommerce: svc('/api/integrations/woocommerce/connect'),
  disconnectChannel: svc('/api/integrations/disconnect'),
  /** Only the channel name travels; the server holds the credentials. */
  channelOrders: (channel: string) =>
    svc(`/api/integrations/orders?${new URLSearchParams({ channel })}`),

  // ── Core host (relative — `apiRequest` prefixes API_BASE_URL) ──
  syncTracking: (awb: string) => `/api/v1/shipments/sync/${encodeURIComponent(awb)}`,
  markRto: '/api/v1/shipments/mark-rto',
  b2bCargo: '/api/v1/xpressbees/b2b-cargo',
  publicTrack: (awb: string) => `/api/public/track/${encodeURIComponent(awb)}`,
  pincode: (pin: string) => `/api/pincode/${encodeURIComponent(pin)}`,
  supportChat: '/api/support/chat',
} as const;

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

/**
 * Without this, a host that drops packets rather than refusing the connection
 * leaves `fetch` pending forever, and any `finally` that resets a "processing"
 * flag never runs — the UI sticks on a spinner with no way out.
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * The only hosts allowed to receive a Firebase ID token. Both are our own
 * deployments, and `SERVICES_BASE_URL` still honours the `EXPO_PUBLIC_PAYMENTS_URL`
 * override, so pointing at a dev server on the LAN keeps working.
 *
 * The two are usually the same host now that the services live on the website.
 * Both are still listed rather than collapsed: the override can point
 * `SERVICES_BASE_URL` somewhere else at any time, and a list that silently
 * dropped it would stop sending the token to a LAN dev server.
 */
const TRUSTED_ORIGINS = [...new Set([API_BASE_URL, SERVICES_BASE_URL])].map((u) =>
  u.replace(/\/+$/, '')
);

/**
 * Prefix matching alone would accept `https://www.shipmatrix.in.evil.com`, so the
 * character after the base has to be a path separator or nothing at all.
 */
function isTrustedOrigin(url: string): boolean {
  return TRUSTED_ORIGINS.some((base) => {
    if (!url.startsWith(base)) return false;
    const rest = url.slice(base.length);
    return rest === '' || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('#');
  });
}

/**
 * What to say when the server answered with something that is not JSON.
 *
 * Every route this app calls replies in JSON, so a non-JSON body means the
 * request never reached its handler — a host serving its SPA for an unknown
 * path, a gateway's own error page, a deployment missing the route entirely.
 * The old text was `Request failed with status ${status}`, which is how a
 * wallet recharge came to tell users "Request failed with status 404": true,
 * and of no use to anyone.
 */
function describeNonJsonError(status: number): string {
  if (status === 404) {
    return 'This feature is not available on the server the app is set up to use. Please update the app or contact support.';
  }
  if (status === 401 || status === 403) {
    return 'Your session is no longer valid. Please sign in again.';
  }
  if (status >= 500) {
    return 'The server is having trouble right now. Please try again in a moment.';
  }
  return `The server returned an unexpected response (status ${status}). Please try again.`;
}

/**
 * Turns an error payload into something worth showing a user.
 *
 * A rejected body comes back as a fixed `error` of "Invalid request body."
 * with the actual reason in `details` — one entry per field. Reading `error`
 * alone told the user only that something was wrong, never what, so a
 * mistyped email surfaced two screens away from the field that held it.
 */
function describeError(data: any, status: number): string {
  const base = data?.error || data?.message || `Request failed with status ${status}`;

  const fields = (Array.isArray(data?.details) ? data.details : [])
    .map((d: any) => {
      const path = Array.isArray(d?.path) ? d.path.join('.') : d?.path;
      if (!d?.message) return null;
      return path ? `${path}: ${d.message}` : d.message;
    })
    .filter(Boolean);

  return fields.length ? `${base} (${fields.join('; ')})` : base;
}

/**
 * Centralized API client for ShipMatrix.
 * Handles:
 * - Absolute URL construction from relative paths
 * - Automatic Bearer JWT token injection
 * - JSON serialization/deserialization
 * - Error handling
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    skipAuth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Build full URL
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Inject auth token if available.
  //
  // Only ever to our own backends. A Firebase ID token identifies the user for
  // an hour and is enough to act as them, so it must not travel to a host just
  // because a caller passed an absolute URL — one `api.post('https://...')`
  // against a third-party endpoint (a courier callback, a tracking widget)
  // would hand that host the user's session.
  const sendToken = !skipAuth && !!auth.currentUser && isTrustedOrigin(url);
  if (sendToken) {
    try {
      const token = await auth.currentUser!.getIdToken();
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.warn('Failed to get auth token:', e);
    }
  }

  // Build request config
  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  // The timer is cleared as soon as the headers land, not after the body is
  // read, so streamed responses (the PDF path below) are not cut off mid-download.
  const controller = new AbortController();
  // Whether *we* aborted, rather than inspecting the rejection. React Native
  // does not reject with a DOMException named 'AbortError' the way browsers do
  // — it surfaces a generic "Fetch request has been canceled" TypeError — so
  // sniffing `e.name` silently missed every timeout and showed users that raw
  // message instead of an explanation.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...config, signal: controller.signal });

    // A 401 on a request we did authenticate means the server rejected the
    // token, not the user: a cached token that expired against a skewed clock,
    // or one minted before a claims change. `getIdToken(true)` mints a fresh
    // one; one retry, and only for requests that carried a token, so nothing
    // unauthenticated is ever replayed.
    //
    // Deliberately no sign-out on a second 401. A server-side fault would then
    // log every user out at once, and a genuinely revoked or disabled account
    // already surfaces through `onAuthStateChanged` the moment Firebase's own
    // refresh fails.
    if (response.status === 401 && sendToken && auth.currentUser) {
      try {
        const freshToken = await auth.currentUser.getIdToken(true);
        requestHeaders['Authorization'] = `Bearer ${freshToken}`;
        response = await fetch(url, {
          ...config,
          headers: requestHeaders,
          signal: controller.signal,
        });
      } catch (e) {
        console.warn('Token refresh after 401 failed:', e);
      }
    }
  } catch (e: any) {
    if (timedOut) {
      throw new ApiError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. Check that ${url} is reachable.`,
        0
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  // Handle non-JSON responses (e.g., PDF downloads)
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(describeNonJsonError(response.status), response.status);
    }
    return response as unknown as T;
  }

  // A body that claims to be JSON and is not. Reaching `response.json()` with
  // an HTML error page — a gateway's own 502, a host answering an unknown path
  // with index.html — throws a raw SyntaxError, and "JSON Parse error:
  // Unexpected character: <" is what the user would have been shown.
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(describeNonJsonError(response.status), response.status);
  }

  if (!response.ok) {
    throw new ApiError(describeError(data, response.status), response.status, data);
  }

  return data;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T = any>(endpoint: string, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T = any>(endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
};
