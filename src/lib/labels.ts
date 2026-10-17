import { API_BASE_URL, api } from './api';
import { isHeavyLoadCourier } from './shipments';
import type { Shipment } from '../types';

/**
 * Resolving a shipment's printable label.
 *
 * There is no single label URL. `labelUrl` on the record is only filled in
 * when the booking response happened to carry one, which most couriers do not
 * do — labels are generated on their side after the manifest is pushed. Every
 * courier instead exposes its own route on the API host, so the label has to
 * be resolved from the courier name at print time.
 *
 * The order of the checks below mirrors the order list on the web app, so both
 * surfaces print the same document for the same shipment. Keep them in step.
 */

/** Absolute URL for a route on the API host — `Linking` cannot open a bare path. */
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

/** Couriers arrive as display names ('ShipMatrix Heavy Load', 'Blue Dart Surface'). */
const carrier = (s: Shipment) => (s.courier || s.courierName || '').toLowerCase();

export class LabelError extends Error {}

/**
 * The URL to open for this shipment's label.
 *
 * @throws {LabelError} with a message worth showing when no label exists yet.
 */
export async function resolveLabelUrl(shipment: Shipment): Promise<string> {
  const awb = shipment.awb?.trim();
  if (!awb) {
    throw new LabelError(
      'This order has no AWB yet. The label is created once the courier assigns one.'
    );
  }

  const name = carrier(shipment);
  const enc = encodeURIComponent(awb);

  // A label the courier already handed us at booking wins — but only when it
  // is a real destination. A stored `/api/...` path is this host's own route,
  // which the courier branches below build correctly (and with fresher params).
  const stored = shipment.labelUrl?.trim();
  if (stored && !stored.includes('/api/')) {
    return stored.startsWith('http')
      ? stored
      : apiUrl(stored.startsWith('/') ? stored : `/${stored}`);
  }

  if (name.includes('ekart')) return apiUrl(`/api/ekart/label/${enc}`);

  // Shadowfax 360 (sold as ShipMatrix Heavy Load) is a separate integration
  // from plain Shadowfax, so it has to be matched before the general case
  // swallows it.
  if (isHeavyLoadCourier(name)) {
    return apiUrl(`/api/shadowfax_360/label/${enc}`);
  }
  if (name.includes('shadowfax')) return apiUrl(`/api/shadowfax/label/${enc}`);

  if (name.includes('amazon')) {
    const shipmentRef = shipment.amazonShipmentId || shipment.shipmentId || awb;
    const pkgRef = shipment.pkgRefId || shipment.orderId || awb;
    return apiUrl(
      `/api/amazon/label/${encodeURIComponent(shipmentRef)}?pkgRefId=${encodeURIComponent(pkgRef)}`
    );
  }

  if (name.includes('shreemaruti') || name.includes('shree maruti')) {
    return apiUrl(`/api/shreemaruti/label/${enc}`);
  }

  if (name.includes('bluedart') || name.includes('blue dart')) {
    return apiUrl(`/api/bluedart/label/${enc}`);
  }

  // Smartship addresses labels by its own order id, not the AWB. The route
  // resolves one from the other, so the AWB is still what gets passed here.
  if (name.includes('smartship')) return apiUrl(`/api/smartship/label/${enc}`);

  // KW Delhivery Surface is booked through Kourierwale, so its AWB means
  // nothing to Delhivery's label API. Kourierwale hands the label over at
  // booking (stored above); this route redirects to that same stored copy.
  if (name.includes('kw delhivery') || name.includes('delhivery_kw')) {
    return apiUrl(`/api/kourierwale/label/${enc}`);
  }

  // Delhivery answers with JSON describing the packages, not the PDF itself.
  if (name.includes('delhivery')) {
    let data: any;
    try {
      data = await api.get(`/api/delhivery/label/${enc}`);
    } catch {
      throw new LabelError('Could not reach Delhivery for this label. Try again in a moment.');
    }
    const link = data?.packages?.[0]?.pdf_download_link;
    if (!link) {
      throw new LabelError(`Delhivery has not published a label for ${awb} yet.`);
    }
    return link;
  }

  // Anything else falls back to the label the API renders itself. The web app
  // builds this same document in the page as a blob URL, which a phone browser
  // cannot open — this route serves the identical thing over HTTP.
  return apiUrl(
    `/api/mock/label/${encodeURIComponent(shipment.courier || shipment.courierName || 'Shipping')}/${enc}`
  );
}
