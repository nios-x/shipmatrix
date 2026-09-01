import { auth } from './firebase';
import { api, ApiError, PAYMENTS_BASE_URL } from './api';
import type { Shipment } from '../types';

/** Reasons offered in the cancel sheet. Same list the web app shows. */
export const CANCEL_REASONS = [
  'Customer changed mind',
  'Order delayed',
  'Incorrect address / details',
  'Found better price',
  'Other',
];

/**
 * A cancellation that failed for a reason worth showing the user — an
 * unsupported courier, a courier that refused, a lost connection. Anything
 * thrown that is *not* one of these is a bug, not a rejected cancellation.
 */
export class CancelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancelError';
  }
}

/**
 * Cancels a booked order: releases the AWB at the courier, marks the record
 * Cancelled and refunds the freight charge to the wallet.
 *
 * All of that happens on the payments server. It used to happen here, in a
 * Firestore transaction that credited `walletBalance` directly — but a client
 * able to credit its own balance can credit it without cancelling anything, so
 * the rules now refuse those writes and the work moved behind an endpoint that
 * verifies the caller and re-reads the shipment itself.
 *
 * Which courier to call, what the refund is worth, and whether the order was
 * already cancelled are all decided there from the stored shipment, so nothing
 * but its id and the reason travels.
 *
 * Resolves with the amount actually refunded (0 when the order was already
 * cancelled elsewhere, or carried no freight charge). Rejects with a
 * `CancelError` carrying a message meant for the user.
 */
export async function cancelOrder(shipment: Shipment, reason: string): Promise<number> {
  if (!auth.currentUser) {
    throw new CancelError('You are signed out. Sign in again to cancel this order.');
  }

  if (!shipment.awb) {
    throw new CancelError('This order has no AWB yet, so there is nothing for the courier to cancel.');
  }

  try {
    const res = await api.post(`${PAYMENTS_BASE_URL}/api/shipments/cancel`, {
      shipmentId: shipment.id,
      reason,
    });
    return Number(res.refunded) || 0;
  } catch (e: any) {
    throw new CancelError(
      e instanceof ApiError
        ? e.message
        : 'Could not reach the server. Check your connection and try again.'
    );
  }
}
