/**
 * Input sanitising and validation for Indian address/parcel data.
 *
 * Two jobs, deliberately separated:
 *
 * - The `only*` helpers run on every keystroke and *remove* what cannot be
 *   typed. They never reject — a field that clears itself as you type is
 *   unusable — so they only ever narrow the string.
 * - The `check*` helpers run at submit and explain what is wrong.
 *
 * Keyboard type alone is not a constraint. `phone-pad` still offers `+`, `*`
 * and `#`, `decimal-pad` allows several dots, and every soft keyboard can be
 * bypassed by pasting. The bounds here mirror the server's zod schema in
 * `routes/shipments.ts`, so a form that passes locally is not then rejected
 * by the API for a rule the user was never shown.
 */

/** India: 6 digits, never leading zero. */
export const PINCODE_RE = /^[1-9]\d{5}$/;

/** India: 10-digit mobile starting 6-9. Landlines are not accepted by couriers. */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Deliberately permissive — the server does the authoritative check. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Matches the server's zod bounds so the two cannot disagree. */
export const LIMITS = {
  weightKg: { min: 0.01, max: 1000 },
  dimensionCm: { min: 1, max: 500 },
  orderValue: { min: 1, max: 10_000_000 },
} as const;

/** Strips everything but digits, then truncates. Safe against paste. */
export function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Keeps a single decimal point and caps the digits either side.
 *
 * A plain `replace(/[^\d.]/g, '')` lets "1.2.3" through, which `parseFloat`
 * silently reads as 1.2 — the parcel is then priced at a weight the user did
 * not enter.
 */
export function onlyDecimal(value: string, intDigits = 4, decimals = 2): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');

  if (firstDot === -1) return cleaned.slice(0, intDigits);

  const whole = cleaned.slice(0, firstDot).slice(0, intDigits);
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, decimals);
  return `${whole}.${fraction}`;
}

/** Collapses runs of whitespace; leaves a single trailing space so words can be typed. */
export function singleSpaced(value: string): string {
  return value.replace(/\s{2,}/g, ' ');
}

export interface FieldError {
  field: string;
  message: string;
}

export function checkPincode(value: string, label = 'Pincode'): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (!PINCODE_RE.test(v)) return `${label} must be 6 digits and cannot start with 0.`;
  return null;
}

export function checkMobile(value: string, label = 'Phone number'): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (!MOBILE_RE.test(v)) return `${label} must be a 10-digit mobile starting with 6, 7, 8 or 9.`;
  return null;
}

/** Email is optional on a shipment, so an empty value passes. */
export function checkOptionalEmail(value: string, label = 'Email'): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!EMAIL_RE.test(v)) return `${label} does not look like a valid address.`;
  return null;
}

export function checkNumberInRange(
  value: string,
  { min, max }: { min: number; max: number },
  label: string,
  unit = ''
): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;

  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < min) return `${label} must be at least ${min}${unit}.`;
  if (n > max) return `${label} cannot exceed ${max}${unit}.`;
  return null;
}

/** Returns the first problem found, or null. Order matches the form's reading order. */
export function firstError(checks: (string | null)[]): string | null {
  return checks.find((c): c is string => c !== null) ?? null;
}
