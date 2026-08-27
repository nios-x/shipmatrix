export interface CourierRate {
  id: string;
  name: string;
  rating: number;
  expectedDelivery: string;
  rate: number;
  logoText: string;
  features: string[];
}

export interface User {
  id: string;
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  gstNo?: string;
  noOfOrders?: string;
  companyType?: string;
  walletBalance: number;
  role: string;
  apiKey?: string;
  needsOnboarding?: boolean;
  createdAt?: any;
  warehouses?: Warehouse[];
  /** Default pickup warehouse used when booking shipments. */
  warehouseData?: WarehouseData;
  bankDetails?: BankDetails;
  notificationPrefs?: NotificationPrefs;
  integrations?: Integrations;
}

/** Sales-channel credentials, stored under `integrations` on the user doc. */
export interface Integrations {
  shopify?: {
    domain?: string;
    accessToken?: string | null;
    clientId?: string;
    clientSecret?: string;
  };
  woocommerce?: {
    domain?: string;
    key?: string;
    secret?: string;
  };
}

export interface BankDetails {
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
}

export interface NotificationPrefs {
  emailNotif?: boolean;
  smsNotif?: boolean;
  pushNotif?: boolean;
  autoLabel?: boolean;
}

export interface Warehouse {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

/**
 * Canonical shipment shape as stored in Firestore at `users/{uid}/shipments`.
 *
 * IMPORTANT: these field names are shared with the ShipMatrix web app, the
 * admin panel and the `/api/{courier}/create-shipment` server routes. The
 * destination address is stored flat (`address`/`city`/`state`/`pincode`) and
 * the payment mode is `paymentMethod: 'COD' | 'Prepaid'` (title case) — do not
 * rename these to mobile-only variants or the records stop interoperating.
 */
export interface Shipment {
  id: string;
  awb?: string;
  courier?: string;
  courierName?: string;
  carrierId?: string;
  /** Title case, e.g. 'Booked' | 'In Transit' | 'Delivered' | 'NDR' | 'RTO'. */
  status?: string;
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;

  // Destination address (flat — matches server + web)
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  // Pickup / return warehouse
  pickupLocationName?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupPincode?: string;
  pickupPhone?: string;

  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;

  /** 'COD' | 'Prepaid' — title case, matches web/admin. */
  paymentMethod?: string;
  /** Declared value of the shipment; also the COD collection amount. */
  orderValue?: number;
  codAmount?: number;

  productName?: string;
  freightCharge?: number;
  labelUrl?: string;
  trackingUrl?: string;

  /** True for reverse pickups (returns collected from the customer). */
  isReverse?: boolean;
  returnReason?: string;

  // COD remittance
  remittanceStatus?: string;
  remittedAt?: any;
  isCodRemittance?: boolean;
  description?: string;

  createdAt?: any;
  updatedAt?: any;
  deliveredAt?: any;
  shipmentId?: string;
  pkgRefId?: string;
}

/** Pickup warehouse stored on the user document as `warehouseData`. */
export interface WarehouseData {
  name: string;
  email?: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  returnName?: string;
  returnPhone?: string;
  returnAddress?: string;
  returnPincode?: string;
  returnCity?: string;
  returnState?: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description?: string;
  reference?: string;
  createdAt?: any;
  balance?: number;
}

export interface RateResult {
  carrier_id: string;
  carrier_name?: string;
  freight_charge: number;
  estimated_days?: number;
  cod_charges?: number;
  total_charge?: number;
}

/** Stored at `users/{uid}/notifications` — shape shared with the web app. */
export interface Notification {
  id: string;
  title?: string;
  message?: string;
  /** e.g. 'Order Updates' | 'Wallet Alerts' | 'COD Updates' | 'Promotions'. */
  category?: string;
  /** Legacy discriminator kept for older records: 'order' | 'refund' | 'cancel'. */
  type?: string;
  read?: boolean;
  actionLink?: string;
  actionText?: string;
  createdAt?: any;
}
