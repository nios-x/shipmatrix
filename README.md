# 🚀 ShipMatrix Mobile Application

[![React Native](https://img.shields.io/badge/React_Native-0.85.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-56.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NativeWind](https://img.shields.io/badge/NativeWind-TailwindCSS-38B2AC?logo=tailwindcss&logoColor=white)](https://www.nativewind.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v11-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Proprietary-violet)](#)

> **ShipMatrix** is an enterprise-grade multi-carrier logistics, freight forwarding, and e-commerce shipping aggregation platform built for Indian businesses, D2C brands, and B2B enterprises.

---

## 📱 Features & Highlights

### 📦 1. Forward & Reverse Logistics
* **Multi-Carrier Rate Calculator**: Real-time freight quote comparisons across top Indian couriers (**Delhivery, Xpressbees, BlueDart, Shadowfax, DTDC, Amazon Shipping, Smartr**).
* **Live Courier Selection**: Filter by **Air Express vs. Surface**, **Cheapest vs. Fastest**, Doorstep pickup, and transit insurance.
* **1-Click Forward Booking**: Address autofill, pincode serviceability check, dead vs. volumetric weight calculation, and automatic AWB generation.
* **Reverse Logistics & Returns**: Book customer return pickups, track reverse transit stages, and inspect return-to-origin (RTO) statuses.
* **Bulk Shipment Upload**: Document picker integration for CSV-based bulk order imports.

### 🚛 2. B2B Heavy Cargo & Freight Manifestation
* **XpressBees Cargo Integration**: Direct integration with the `AddCargoManifestDetails` API endpoint.
* **Multi-Modal Route Routing**:
  * **Surface Cargo** (Parent AWB series `9169...`)
  * **Air Cargo** (Parent AWB series `7167...`)
* **Multi-Piece Shipments (MPS)**: Create manifests supporting up to 10 boxes per consignment with live cubic feet (CFT) and volumetric metrics.
* **Commercial Compliance**: GST invoice validation, e-Way bill capture (> ₹50,000 threshold), and Credit / ToPay booking modes.

### 📊 3. Smart Dashboard & Tracking
* **Real-time Metrics**: Live stats for *Today's Orders, In Transit, Delivered, RTO, and NDR Exceptions*.
* **Interactive Quick-Action Carousel**: Direct navigation to Rate Calculator, B2B Cargo, Wallet, Orders, Tracking, Returns, and Bulk Upload.
* **Live AWB Timeline Tracking**: Granular tracking timeline with checkpoint status badges and courier partner identification.

### ⚠️ 4. Exception & Dispute Management
* **NDR (Non-Delivery Reports)**:
  * Real-time courier delivery exceptions (e.g. *Customer Unreachable, Door Locked, Address Issue*).
  * Direct 1-tap buyer call dialer.
  * Schedule custom delivery re-attempts with rider instructions or trigger return-to-origin (RTO).
* **Weight Discrepancy Reconciliation**:
  * Side-by-side audit comparing *Declared Dead Weight* vs. *Courier Charged Weight*.
  * 1-tap "Accept Charge" or "Raise Dispute" with remarks and evidence arbitration.

### 💳 5. Wallet, Remittances & Invoicing
* **Instant Wallet Recharge**: Native Cashfree checkout (`react-native-cashfree-pg-sdk`) with predefined top-up amounts (₹500, ₹1000, ₹2000, ₹5000). Orders are created and verified server-side, so the app never reports an amount.
* **Transparent Ledger**: Real-time transaction history with automatic credit/debit badges.
* **COD Remittance**: Total Cash on Delivery collection breakdown and settlement logs.
* **Invoices & Billing**: View and export commercial invoices and shipping charge statements.

### 🔐 6. Authentication & User Profile
* **Dual Auth Support**:
  * Email / Password authentication with 2-step company onboarding (GST, order volume, business type).
  * **Google Sign-In**: Cross-platform Google OAuth integration with automatic Firestore profile provisioning.
  * Secure password recovery flow.
* **Role-Based Access**: Role-gated administration panel for support ticket resolution and user monitoring.

---

## 🛠️ Tech Stack & Architecture

```
my-expo-app/
├── App.tsx                      # Root component: Font loader, Redux Provider, Toast & Navigation shell
├── app.json                     # Expo SDK 56 metadata & plugins configuration
├── tailwind.config.js           # NativeWind typography, Raleway tokens & color palettes
├── global.css                   # Global styling & universal font definitions
├── src/
│   ├── components/              # Reusable UI elements (CourierLogo, GoogleIcon, CustomAlert, EmptyState, etc.)
│   ├── navigation/              # React Navigation 7 (AuthStack, MainTabNavigator, RootNavigator)
│   ├── store/                   # Redux Toolkit slices (authSlice, shipmentsSlice, walletSlice)
│   ├── lib/                     # Firebase Auth/Firestore, Storage, API Client, Alert bridge, Google OAuth
│   ├── types.ts                 # Strict TypeScript schemas & domain interfaces
│   └── screens/                 # 22+ Core Application Screens
│       ├── DashboardScreen.tsx
│       ├── OrdersScreen.tsx
│       ├── CreateShipmentScreen.tsx
│       ├── CreateReverseShipmentScreen.tsx
│       ├── RateCalculatorScreen.tsx
│       ├── AvailableCouriersScreen.tsx
│       ├── B2bCargoScreen.tsx
│       ├── TrackingScreen.tsx
│       ├── NdrScreen.tsx
│       ├── WeightDiscrepancyScreen.tsx
│       ├── WalletScreen.tsx
│       ├── CodRemittanceScreen.tsx
│       ├── BulkUploadScreen.tsx
│       ├── ChannelsScreen.tsx
│       ├── CourierPerformanceScreen.tsx
│       ├── ApiDocsScreen.tsx
│       ├── SupportScreen.tsx
│       ├── BillingScreen.tsx
│       ├── SettingsScreen.tsx
│       ├── ProfileScreen.tsx
│       ├── LoginScreen.tsx
│       └── SignupScreen.tsx
```

---

## 🔒 Backend & Trust Boundary

The app talks to **`shipmatrix-server`** (sibling repo, `EXPO_PUBLIC_PAYMENTS_URL`) for everything that
moves money or privilege. The app is not trusted: the Firebase config ships inside the bundle, so any
account holder can call Firestore directly with their own ID token. Anything the rules permit, a user
can do by hand.

| Operation | Where it runs | Why |
| --- | --- | --- |
| Rate quotes | `POST /api/rates` | The price that gets charged is fetched server-side, not sent by the app |
| Booking | `POST /api/shipments/book` | Balance check + debit share one transaction; courier call wrapped in a reserve → confirm/refund saga with an idempotency key |
| Cancellation | `POST /api/shipments/cancel` | Refunds credit the wallet, so it cannot be client-side |
| Wallet recharge | `POST /api/cashfree/*` | Amount comes from Cashfree, never from the app |
| Signup | `POST /api/otp/register` | Verifying the code and creating the account are one call, so the code actually gates it |
| Store credentials | `POST /api/integrations/*` | Shopify/Woo secrets live in a collection no client rule grants |

`walletBalance`, `role` and `integrations` are **unwritable by clients** — see `firestore.rules` in the
server repo. Deploy the server **before** the rules: reversed, bookings fail because the app can no
longer write the balance and nothing else can yet.

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js (v18+)](https://nodejs.org/) or [Bun](https://bun.sh/)
* [Expo CLI](https://docs.expo.dev/get-started/installation/)
* Android Studio (for Android Emulator) or Xcode (for iOS Simulator) / Expo Go app on a physical device.

### 2. Installation
Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/nios-x/shipmatrix.git
cd shipmatrix

# Install dependencies using Bun or npm
bun install
# or
npm install
```

### 3. Run Development Server

```bash
# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web

# Start Metro Bundler
npm start
```

### 4. Type Checking & Code Quality

```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Lint & Format
npm run lint
npm run format
```

---

## 🎨 Design System & Fonts

The application utilizes **Google Raleway** (`@expo-google-fonts/raleway`) across all text styles, complemented by a tailored color palette:
* **Primary Brand Accent**: `Violet-700` (`#6D28D9`) / `Violet-600` (`#7C3AED`)
* **Background**: Slate Clean (`#F8FAFC`) / White (`#FFFFFF`)
* **Status Colors**: Emerald (`Delivered/Success`), Amber (`In-Transit/Warning`), Rose (`RTO/NDR/Error`)

---

## 📄 License & Ownership
Copyright © 2026 **ShipMatrix Logistics Technologies**. All rights reserved.
Proprietary software for enterprise logistics management.
