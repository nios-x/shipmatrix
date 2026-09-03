/**
 * Navigation type definitions for the entire app.
 * Maps screen names to their route parameters.
 */

// Auth flow screens (before login)
export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
};

// Main tab screens
export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  RatesTab: undefined;
  WalletTab: undefined;
  ProfileTab: undefined;
};

// Home stack (screens reachable from Dashboard)
export type HomeStackParamList = {
  Dashboard: undefined;
  Tracking: { awb?: string };
  BulkUpload: undefined;
  B2bCargo: undefined;
  Notifications: undefined;
  CourierPerformance: undefined;
  Channels: undefined;
  Ndr: undefined;
  WeightDiscrepancy: undefined;
  /**
   * Measures a parcel from a photo. `returnTo` marks the entry point that
   * expects the result back, so the screen knows whether to pop to the booking
   * form already in the stack or jump across to the Orders tab.
   */
  ParcelSizer: { returnTo?: 'CreateShipment' } | undefined;
  AvailableCouriers: {
    pickupPin: string;
    deliveryPin: string;
    weight: string;
    length?: string;
    width?: string;
    height?: string;
    rates?: any[];
  };
};

// Orders stack
export type OrdersStackParamList = {
  Orders: undefined;
  /**
   * The shipment is looked up live by id rather than passed as an object:
   * route params must stay serialisable, and Firestore Timestamps are not.
   */
  OrderDetails: { shipmentId: string };
  Tracking: { awb?: string };
  CreateShipment: {
    orderId?: string;
    pickupPincode?: string;
    deliveryPincode?: string;
    weight?: string;
    length?: string;
    breadth?: string;
    height?: string;
    selectedCarrier?: string;
  };
  CreateReverseShipment: { shipmentId?: string };
  ParcelSizer: { returnTo?: 'CreateShipment' } | undefined;
};

// Rates stack
export type RatesStackParamList = {
  RateCalculator: undefined;
  AvailableCouriers: {
    pickupPin: string;
    deliveryPin: string;
    weight: string;
    length?: string;
    width?: string;
    height?: string;
    rates?: any[];
  };
};

// Wallet stack
export type WalletStackParamList = {
  Wallet: undefined;
  Billing: undefined;
  CodRemittance: undefined;
};

// Profile stack
export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Support: undefined;
  ApiDocs: undefined;
  Returns: undefined;
  AdminPanel: undefined;
};

// Root navigator
export type RootStackParamList = {
  Loading: undefined;
  Auth: undefined;
  Main: undefined;
};
