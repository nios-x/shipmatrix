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

export interface Shipment {
  id: string;
  awb?: string;
  courier?: string;
  status?: string;
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPincode?: string;
  pickupAddress?: string;
  pickupPincode?: string;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  paymentType?: 'prepaid' | 'cod';
  codAmount?: number;
  productName?: string;
  productValue?: number;
  labelUrl?: string;
  trackingUrl?: string;
  createdAt?: any;
  updatedAt?: any;
  shipmentId?: string;
  pkgRefId?: string;
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

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  type?: string;
}
