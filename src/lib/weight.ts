/**
 * Chargeable weight, computed exactly as the server computes it.
 *
 * Mirrors `chargeableWeight` in the web repo's `services/couriers/types.ts`:
 * the parcel is billed on the greater of its actual weight and its volumetric
 * weight, with volumetric = L × B × H (cm) ÷ 5000. The rate endpoint resolves
 * this before asking any courier, so a figure shown here is the figure the
 * quote was priced on. Three screens used to open-code the formula; if the
 * divisor ever changes it must change here and on the server together.
 */

import { LIMITS } from './inputs';

/** Volumetric divisor used across Indian ecommerce carriers (cm³ per kg). */
export const VOLUMETRIC_DIVISOR = 5000;

/** Volumetric weight in kg, or 0 until all three sides are positive. */
export function volumetricWeight(lengthCm: number, breadthCm: number, heightCm: number): number {
  if (!(lengthCm > 0 && breadthCm > 0 && heightCm > 0)) return 0;
  return (lengthCm * breadthCm * heightCm) / VOLUMETRIC_DIVISOR;
}

export type WeightBasis = 'actual' | 'volumetric';

export interface WeightBreakdown {
  actual: number;
  volumetric: number;
  chargeable: number;
  /** Which of the two sets the bill. Ties go to actual. */
  basis: WeightBasis;
  /** True once there is enough to say anything: a weight or a full box. */
  ready: boolean;
}

/** Parses a text field the way the booking payload does. */
const num = (v: string | number | undefined | null) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function weightBreakdown(
  actualKg: string | number | undefined | null,
  lengthCm: string | number | undefined | null,
  breadthCm: string | number | undefined | null,
  heightCm: string | number | undefined | null
): WeightBreakdown {
  const actual = num(actualKg);
  const volumetric = volumetricWeight(num(lengthCm), num(breadthCm), num(heightCm));
  const basis: WeightBasis = volumetric > actual ? 'volumetric' : 'actual';
  return {
    actual,
    volumetric,
    chargeable: Math.max(actual, volumetric),
    basis,
    ready: actual > 0 || volumetric > 0,
  };
}

/** Field-level range checks, returned as messages for inline display. */
export function dimensionError(value: string, label: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < LIMITS.dimensionCm.min) {
    return `${label} must be at least ${LIMITS.dimensionCm.min} cm`;
  }
  if (n > LIMITS.dimensionCm.max) return `${label} cannot exceed ${LIMITS.dimensionCm.max} cm`;
  return null;
}

export function weightError(value: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < LIMITS.weightKg.min) {
    return `Weight must be at least ${LIMITS.weightKg.min} kg`;
  }
  if (n > LIMITS.weightKg.max) return `Weight cannot exceed ${LIMITS.weightKg.max} kg`;
  return null;
}
