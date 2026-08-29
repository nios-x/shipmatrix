import type { Shipment, WarehouseData } from '../types';

/**
 * Shared helpers for reading shipment records.
 *
 * Records in `users/{uid}/shipments` are written by three producers — this app,
 * the web app and the courier webhooks — and their casing is not consistent
 * ('Delivered' vs 'DELIVERED', 'COD' vs 'cod'). Every screen should compare
 * through these helpers rather than against raw string literals.
 */

/** Firestore Timestamp | epoch millis | ISO string → Date | null. */
export function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(typeof value === 'number' ? value : String(value));
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: any, fallback = '—'): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : fallback;
}

export function formatDateTime(value: any, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString(
    'en-IN',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
}

/** Uppercased status with separators collapsed, e.g. 'in_transit' → 'IN TRANSIT'. */
export function normalizeStatus(shipment: Pick<Shipment, 'status'>): string {
  return (shipment.status || '').replace(/[_-]+/g, ' ').trim().toUpperCase();
}

/**
 * Status pill colours, as a "<background> <text>" pair of Tailwind classes.
 * Lives here so the list and the detail screen cannot drift apart.
 */
const STATUS_COLORS: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  'IN TRANSIT': 'bg-amber-100 text-amber-700',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  NDR: 'bg-red-100 text-red-700',
  RTO: 'bg-red-100 text-red-700',
  EXCEPTION: 'bg-orange-100 text-orange-700',
  'PICKUP DONE': 'bg-cyan-100 text-cyan-700',
  'PICKED UP': 'bg-cyan-100 text-cyan-700',
  DEFAULT: 'bg-gray-100 text-gray-600',
};

/** Returns `[backgroundClass, textClass]` for a shipment's status pill. */
export function statusPillClasses(shipment: Pick<Shipment, 'status'>): [string, string] {
  const pair = STATUS_COLORS[normalizeStatus(shipment)] || STATUS_COLORS.DEFAULT;
  const [bg, text] = pair.split(' ');
  return [bg!, text!];
}

/**
 * Status vocabulary. The server's sync job (`/api/v1/shipments/sync-all`) polls
 * shipments whose status is one of Pending / Processing / New / Ready to Pickup
 * / Picked Up / In Transit / Out for Delivery, so a newly booked shipment must
 * carry one of those or it never receives tracking updates.
 */
export const BOOKED_STATUS = 'Ready to Pickup';

const BOOKED = ['BOOKED', 'READY TO PICKUP', 'PENDING', 'PROCESSING', 'NEW'];
const IN_TRANSIT = ['IN TRANSIT', 'SHIPPED', 'PICKUP DONE', 'PICKED UP', 'OUT FOR DELIVERY', 'DISPATCHED'];
const NDR = ['NDR', 'UNDELIVERED', 'EXCEPTION', 'ATTEMPTED', 'ON HOLD', 'NC', 'NA', 'NOT ATTEMPTED'];
const RTO = ['RTO', 'RTO IN TRANSIT', 'RTO INITIATED', 'RTO DELIVERED', 'RETURN', 'RETURNED'];

export const isDelivered = (s: Shipment) => normalizeStatus(s) === 'DELIVERED';
export const isBooked = (s: Shipment) => BOOKED.includes(normalizeStatus(s));
export const isCancelled = (s: Shipment) => normalizeStatus(s) === 'CANCELLED';
export const isInTransit = (s: Shipment) => IN_TRANSIT.includes(normalizeStatus(s));
export const isNdr = (s: Shipment) => NDR.includes(normalizeStatus(s));
export const isRto = (s: Shipment) => RTO.includes(normalizeStatus(s));
/** True while the shipment is still moving — not delivered, RTO or cancelled. */
export const isActive = (s: Shipment) =>
  !isDelivered(s) && !isRto(s) && !isCancelled(s);

/** True when the shipment is collect-on-delivery, whatever casing was stored. */
export function isCod(s: Shipment): boolean {
  return (s.paymentMethod || '').toUpperCase() === 'COD';
}

/** Amount to be collected / remitted for a COD shipment. */
export function codValue(s: Shipment): number {
  return Number(s.codAmount ?? s.orderValue ?? 0) || 0;
}

/** COD remittance is settled once the courier has paid out. */
export function isRemitted(s: Shipment): boolean {
  return (s.remittanceStatus || '').toUpperCase() === 'PAID';
}

/**
 * COD remittance rows exclude synthetic ledger entries (`isCodRemittance`),
 * which represent the payout itself rather than a collectable order.
 */
export function codRemittanceOrders(shipments: Shipment[]): Shipment[] {
  return shipments.filter((s) => isCod(s) && isDelivered(s));
}

/** Real shipments only — drops the synthetic COD payout ledger entries. */
export function realShipments(shipments: Shipment[]): Shipment[] {
  return shipments.filter((s) => !s.isCodRemittance);
}

/** Days between booking and delivery, or null when either end is missing. */
export function deliveryDays(s: Shipment): number | null {
  const start = toDate(s.createdAt);
  const end = toDate(s.deliveredAt) || toDate(s.updatedAt);
  if (!start || !end) return null;
  const days = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
  return days < 0 ? 0 : days;
}

/** Single-line destination summary for list rows. */
export function destinationLabel(s: Shipment): string {
  return [s.city, s.pincode].filter(Boolean).join(', ') || s.address || 'N/A';
}

/**
 * Maps a rate carrier id to the `/api/{path}/create-shipment` route that books
 * it. Mirrors the branch order used by the web app: the `_360` variant must be
 * matched before the generic `shadowfax` prefix.
 */
export function courierEndpoint(carrierId: string): string {
  const id = (carrierId || '').toLowerCase();
  if (id === 'shadowfax_360') return 'shadowfax_360';
  if (id.startsWith('delhivery')) return 'delhivery';
  if (id.startsWith('amazon')) return 'amazon';
  if (id.startsWith('xpressbees')) return 'xpressbees';
  if (id.startsWith('shadowfax')) return 'shadowfax';
  if (id.startsWith('bluedart')) return 'bluedart';
  if (id.startsWith('shreemaruti')) return 'shreemaruti';
  if (id.startsWith('ekart')) return 'ekart';
  return id;
}

/**
 * Generates a fallback order reference. Lives at module scope because
 * `Date.now()` is impure and must not be called from a component body.
 */
export function generateOrderId(prefix = 'ORD'): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/** Fallback warehouse so a booking never sends empty pickup fields. */
export const EMPTY_WAREHOUSE: WarehouseData = {
  name: '',
  phone: '',
  address: '',
  pincode: '',
  city: '',
  state: '',
};

/**
 * Expands a warehouse into the pickup/return field set the create-shipment
 * routes expect. Return fields fall back to the pickup address.
 */
export function warehousePayload(w: WarehouseData) {
  return {
    pickupLocationName: w.name,
    pickupPincode: w.pincode,
    pickupCity: w.city,
    pickupState: w.state,
    pickupPhone: w.phone,
    pickupAddress: w.address,
    returnLocationName: w.returnName || w.name,
    returnPhone: w.returnPhone || w.phone,
    returnAddress: w.returnAddress || w.address,
    returnPincode: w.returnPincode || w.pincode,
    returnCity: w.returnCity || w.city,
    returnState: w.returnState || w.state,
  };
}

/** True when the warehouse has everything the courier APIs require. */
export function isWarehouseComplete(w?: WarehouseData | null): w is WarehouseData {
  return !!(w && w.name && w.phone && w.address && /^[1-9][0-9]{5}$/.test(w.pincode || '') && w.city && w.state);
}
