/**
 * Display formatting for money, weights and sizes.
 *
 * Everything here is presentation only. Callers keep the precise number —
 * the server prices, debits and refunds in paise-accurate amounts, and a
 * booking sends `quotedCharge` back so it can refuse a stale quote — and
 * format at the last moment, in the render.
 */

const RUPEE = '₹';

/**
 * Groups an integer string the Indian way: 1,23,45,678.
 *
 * Done by hand rather than through `toLocaleString('en-IN')` because the
 * Intl data Hermes ships varies by build, and a price that renders as
 * "12345678" on one device and "1,23,45,678" on another is worse than
 * either.
 */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Floating-point noise guard for ceiling. The server applies a markup
 * multiplier to base charges, and float arithmetic can leave a whole rupee at
 * 80.00000000000001 — which must display as ₹80, not ₹81.
 */
const CEIL_EPSILON = 1e-6;

/** Whole rupees, rounded up. The number the UI shows for any shipping price. */
export function ceilRupees(value: number): number {
  return Math.ceil(value - CEIL_EPSILON);
}

/**
 * A shipping price: courier rates, freight charges, booking charges.
 *
 * Always a whole rupee, always rounded *up* — ₹79.30 shows as ₹80, ₹63.25 as
 * ₹64, and ₹80.00 stays ₹80. A seller should never be quoted a figure lower
 * than what the line item actually costs.
 *
 *   formatRate(79.3)  → "₹80"
 *   formatRate(1234)  → "₹1,234"
 */
export function formatRate(value: unknown, fallback = '—'): string {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  const whole = ceilRupees(n);
  const sign = whole < 0 ? '-' : '';
  return `${sign}${RUPEE}${groupIndian(String(Math.abs(whole)))}`;
}

/** The rate as a bare grouped number, for layouts that set the ₹ glyph separately. */
export function formatRateAmount(value: unknown, fallback = '—'): string {
  return formatRate(value, fallback).replace(RUPEE, '');
}

/**
 * Any other amount of money — wallet balances, ledger entries, refunds, order
 * and COD values. These are exact: a balance shown rounded up would promise
 * funds that are not there. Paise appear only when there are any.
 *
 *   formatCurrency(1999)    → "₹1,999"
 *   formatCurrency(79.3)    → "₹79.30"
 */
export function formatCurrency(value: unknown, fallback = '—'): string {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const [whole, paise] = abs.toFixed(2).split('.');
  const body = groupIndian(whole!) + (paise === '00' ? '' : `.${paise}`);
  return `${sign}${RUPEE}${body}`;
}

/** A plain grouped count: 12,480 shipments. */
export function formatCount(value: unknown, fallback = '0'): string {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  return `${n < 0 ? '-' : ''}${groupIndian(String(Math.round(Math.abs(n))))}`;
}

/**
 * Trims a measurement to at most `decimals` places without trailing zeros, so
 * 0.5 stays "0.5" and 2.0 reads "2" rather than "2.00".
 */
export function trimNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  return String(Number(value.toFixed(decimals)));
}

/** "0.5 kg" — or the fallback when there is nothing to show. */
export function formatWeight(value: unknown, fallback = '—'): string {
  const n = toFiniteNumber(value);
  if (n === null || n <= 0) return fallback;
  return `${trimNumber(n, 2)} kg`;
}

/** "25 × 20 × 5 cm", or null when any side is missing. */
export function formatDimensions(
  length: unknown,
  breadth: unknown,
  height: unknown
): string | null {
  const sides = [length, breadth, height].map(toFiniteNumber);
  if (sides.some((s) => s === null || s <= 0)) return null;
  return `${sides.map((s) => trimNumber(s!, 1)).join(' × ')} cm`;
}
