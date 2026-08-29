import { auth } from './firebase';

// Base URL for the ShipMatrix API server
const API_BASE_URL = 'https://www.shipmatrix.in';

/**
 * Payments run on their own service (see the `shipmatrix-server` project),
 * because they need the Cashfree secret key and Firebase Admin. Point this at
 * that deployment; it can share a host with the main API or stand alone.
 *
 * `EXPO_PUBLIC_PAYMENTS_URL` overrides it — set it in `.env` to reach the
 * server running on your machine (e.g. `http://192.168.1.5:8080`) while the
 * production host is not yet deployed. Expo inlines `EXPO_PUBLIC_*` at bundle
 * time, so changing it needs a restart with `--clear`.
 */
const DEFAULT_PAYMENTS_BASE_URL = 'https://payments.shipmatrix.in';

export const PAYMENTS_BASE_URL = (
  process.env.EXPO_PUBLIC_PAYMENTS_URL || DEFAULT_PAYMENTS_BASE_URL
).replace(/\/+$/, '');

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

  // Inject auth token if available
  if (!skipAuth && auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
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
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status
      );
    }
    return response as unknown as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || data.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
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
