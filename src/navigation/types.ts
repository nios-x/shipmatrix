/**
 * Navigation type definitions for the entire app.
 * Maps screen names to their route parameters.
 */

// Auth flow screens (before login)
export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: { fromGoogle?: boolean };
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
