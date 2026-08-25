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
};

// Orders stack
export type OrdersStackParamList = {
  Orders: undefined;
  CreateShipment: { orderId?: string };
  CreateReverseShipment: { shipmentId?: string };
};

// Rates stack
export type RatesStackParamList = {
  RateCalculator: undefined;
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
  Auth: undefined;
  Main: undefined;
};
