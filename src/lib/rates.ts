/**
 * Courier rate quotes returned by `POST /api/rates`.
 *
 * Both the rate calculator and the courier list parse the same response, so the
 * shape and the parsing live here rather than being duplicated in each screen —
 * they had already drifted apart once.
 */

export interface RateResult {
  carrier_id: string;
  /** Human-readable label, e.g. "Shadowfax 360". Never a raw slug. */
  carrier_name: string;
  freight_charge: number;
  estimated_days?: number;
  /**
   * True when the server priced this from its local list because the carrier
   * has no credentials on the deployment — it can be browsed but never booked.
   *
   * Dropping it here is what made "every courier fails to book" so hard to
   * read: the server marks these rows precisely so nobody is walked into a
   * refusal, and both screens rendered them identically to live quotes.
   */
  estimated?: boolean;
}

/**
 * Fallback transit estimate, in business days, for the rare quote that arrives
 * without one. A fixed number rather than a random one: an estimate that
 * reshuffles itself on every refresh is worse than a conservative constant.
 */
const FALLBACK_ESTIMATED_DAYS = 3;

/**
 * Turns one raw rate row into a `RateResult`.
 *
 * The server sends the display label as `display_name` — there is no
 * `carrier_name` field. Reading the wrong key silently fell through to
 * `carrier_id`, which put raw slugs such as `shadowfax_360` in front of users,
 * broke `CourierLogo` (its lookup table is keyed on the display names), and
 * broke the Air/Surface filter, which decides by looking for "air" in the name —
 * `delhivery` is Delhivery Air but its slug says nothing about that.
 */
export function parseRate(r: any): RateResult {
  return {
    carrier_id: r.carrier_id,
    carrier_name: r.display_name || r.carrier_name || r.carrier_id,
    freight_charge: r.freight_charge,
    estimated_days: r.estimated_days ?? FALLBACK_ESTIMATED_DAYS,
    estimated: Boolean(r.estimated),
  };
}

export function parseRates(rows: unknown): RateResult[] {
  return Array.isArray(rows) ? rows.map(parseRate) : [];
}
