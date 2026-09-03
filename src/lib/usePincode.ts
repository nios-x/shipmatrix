import { useState, useEffect } from 'react';
import { api, routes } from './api';

export interface PincodeInfo {
  city: string;
  state: string;
}

const cache = new Map<string, PincodeInfo | null>();

/** Resolves a 6-digit Indian pincode to its city/state via `/api/pincode/:pin`. */
export async function lookupPincode(pin: string): Promise<PincodeInfo | null> {
  if (!/^[1-9][0-9]{5}$/.test(pin)) return null;
  if (cache.has(pin)) return cache.get(pin) ?? null;

  try {
    // The upstream postal API returns a single-element array.
    const data = await api.get(routes.pincode(pin));
    const entry = Array.isArray(data) ? data[0] : data;
    const office = entry?.PostOffice?.[0];
    const result: PincodeInfo | null = office
      ? { city: office.District || office.Division || '', state: office.State || '' }
      : null;
    cache.set(pin, result);
    return result;
  } catch {
    // Don't cache failures — the next attempt should be able to retry.
    return null;
  }
}

/**
 * Auto-resolves city/state as a pincode field is typed. Returns the resolved
 * values plus a loading flag so the caller can show a spinner in the field.
 */
export function usePincode(pin: string) {
  // The resolution is stored together with the pin it belongs to, so a stale
  // result is simply ignored on render rather than having to be cleared with an
  // extra synchronous setState inside the effect.
  const [resolved, setResolved] = useState<{ pin: string; info: PincodeInfo | null } | null>(null);

  const isValid = /^[1-9][0-9]{5}$/.test(pin);
  const isCurrent = resolved?.pin === pin;

  useEffect(() => {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;

    let cancelled = false;
    lookupPincode(pin).then((info) => {
      if (!cancelled) setResolved({ pin, info });
    });

    return () => {
      cancelled = true;
    };
  }, [pin]);

  return {
    info: isCurrent ? resolved.info : null,
    // In flight whenever the pin is complete but its result hasn't landed yet.
    loading: isValid && !isCurrent,
  };
}
