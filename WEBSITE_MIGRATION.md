# ShipMatrix Website → React Native Migration

## Overview

Migrate the ShipMatrix shipping logistics web application (React + Vite + Tailwind) into the existing Expo React Native project with NativeWind, React Navigation, and Redux Toolkit.

The website is a full-featured shipping aggregator platform with **26 screens**, **60+ API endpoints**, Firebase Auth + Firestore, Razorpay payments, and integrations with 7+ courier services (Delhivery, XpressBees, Ekart, Shadowfax, Amazon, BlueDart, ShreeMaruti).

---

## User Review Required

> [!IMPORTANT]
> **API Base URL**: The website uses relative URLs (`/api/rates`, `/api/delhivery/create-shipment`). The mobile app needs an absolute base URL. Is the production server at `https://www.shipmatrix.in` the correct API base URL to use?

> [!WARNING]
> **Firebase Config**: The website loads Firebase config from `firebase-applet-config.json`. Should the mobile app use the same Firebase project, or a separate one? (Same project recommended for shared auth/database.)

> [!IMPORTANT]
> **Razorpay Payments**: The website uses Razorpay web SDK. For mobile, we'll need `react-native-razorpay`. Is Razorpay the confirmed payment gateway for the mobile app?

> [!IMPORTANT]
> **Phone Auth (reCAPTCHA)**: The website uses `RecaptchaVerifier` for phone OTP login. On React Native, Firebase phone auth works differently (no reCAPTCHA needed with native SDK). We'll use `@react-native-firebase/auth` for this. Is this acceptable?

## Open Questions

1. **Admin Panel**: The web app has an 82KB AdminPanel screen. Should this be included in the mobile app, or is it admin-only/web-only?
2. **Public/SEO Pages** (Landing, Privacy Policy, Terms, SEO pages): These are web-only marketing pages. Should any of them be included as in-app webviews?
3. **Barcode Scanner**: The website uses `html5-qrcode`. We'll replace with `expo-barcode-scanner`. Confirmed?
4. **Google Maps**: The web uses `@vis.gl/react-google-maps` for address autocomplete. Should we use `react-native-maps` + Google Places API?
5. **Push Notifications**: Should we set up Expo push notifications to replace browser notifications?

---

## Proposed Changes

This migration will be executed in **6 phases** to keep changes manageable and testable.

---

### Phase 1: Project Foundation & Dependencies

#### [MODIFY] [package.json](file:///c:/Users/HP/Desktop/my-expo-app/package.json)
Add all required dependencies:

**Navigation**: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `react-native-screens`

**State Management**: `@reduxjs/toolkit`, `react-redux`

**Firebase**: `firebase` (web SDK — compatible with Expo), or `@react-native-firebase/*` for native modules

**Storage**: `@react-native-async-storage/async-storage`, `expo-secure-store`

**UI/UX**: `react-native-toast-message`, `expo-linear-gradient`, `@expo/vector-icons`, `react-native-svg`, `lucide-react-native`

**Utilities**: `expo-barcode-scanner`, `expo-image-picker`, `expo-document-picker`, `expo-clipboard`, `expo-linking`

**Payments**: `react-native-razorpay` (if confirmed)

#### [MODIFY] [tailwind.config.js](file:///c:/Users/HP/Desktop/my-expo-app/tailwind.config.js)
Expand content paths to include `src/` directory structure. Add custom theme colors matching the website's purple/blue palette.

#### [MODIFY] [app.json](file:///c:/Users/HP/Desktop/my-expo-app/app.json)
Update app name to "ShipMatrix", add bundle identifiers, update splash screen config, add required permissions.

#### [MODIFY] [tsconfig.json](file:///c:/Users/HP/Desktop/my-expo-app/tsconfig.json)
Add path aliases for `@/`, `@screens/`, `@components/`, `@lib/`, `@store/` etc.

---

### Phase 2: Core Infrastructure (lib/ layer)

These files are largely portable since they use Firebase Web SDK which works with Expo.

#### [NEW] [firebase.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/firebase.ts)
Port from website. Replace the JSON import with inline config or environment variables. Firebase web SDK is compatible with Expo.

#### [NEW] [firebase-utils.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/firebase-utils.ts)
Direct port — no web-specific APIs used.

#### [NEW] [storage.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/storage.ts)
**Replace** `window.localStorage`/`sessionStorage` → `AsyncStorage` from `@react-native-async-storage/async-storage`. Make functions async.

#### [NEW] [useUser.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/useUser.ts)
Direct port — uses Firebase `onSnapshot` which works in Expo.

#### [NEW] [useShipments.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/useShipments.ts)
Direct port — no web APIs used.

#### [NEW] [useTransactions.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/useTransactions.ts)
Direct port — no web APIs used.

#### [NEW] [api.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/lib/api.ts)
**New file** — centralized API client. Wraps `fetch` with:
- Base URL configuration (configurable for dev/prod)
- Automatic Bearer JWT token injection from `auth.currentUser.getIdToken()`
- Error handling
- Request/response interceptors

This replaces all the scattered `fetch('/api/...')` calls with relative URLs throughout the website.

#### [NEW] [types.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/types.ts)
Direct port of `CourierRate` interface + add additional types discovered in screens.

#### [NEW] [data.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/data.ts)
Direct port of mock courier data.

---

### Phase 3: Redux Store

#### [NEW] [store/index.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/store/index.ts)
Configure Redux store with slices for:

#### [NEW] [store/authSlice.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/store/authSlice.ts)
- Auth state (user, loading, error)
- Syncs with Firebase `onAuthStateChanged`
- Stores Firestore user profile data

#### [NEW] [store/shipmentsSlice.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/store/shipmentsSlice.ts)
- Shipments list from Firestore
- Loading/error states
- Filter/search state

#### [NEW] [store/walletSlice.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/store/walletSlice.ts)
- Wallet balance
- Transaction history

---

### Phase 4: Navigation Architecture

#### [NEW] [navigation/RootNavigator.tsx](file:///c:/Users/HP/Desktop/my-expo-app/src/navigation/RootNavigator.tsx)
Root stack navigator handling:
```
Auth State Check
├── Not Authenticated
│   ├── SplashScreen
│   ├── OnboardingScreen  
│   ├── LoginScreen
│   └── SignupScreen
└── Authenticated
    ├── Needs Onboarding → OnboardingFlow
    └── Main App
        └── BottomTabNavigator
            ├── HomeStack (Dashboard → Tracking, BulkUpload, B2B, etc.)
            ├── OrdersStack (Orders → CreateShipment, OrderDetail)
            ├── RatesStack (RateCalculator)
            ├── WalletStack (Wallet → Billing, CodRemittance)
            └── ProfileStack (Profile → Settings, Support, ApiDocs)
        └── Modal Screens (CreateShipment, Scanner, etc.)
```

#### [NEW] [navigation/AuthNavigator.tsx](file:///c:/Users/HP/Desktop/my-expo-app/src/navigation/AuthNavigator.tsx)
Stack navigator for auth flow (Splash → Onboarding → Login/Signup).

#### [NEW] [navigation/MainTabNavigator.tsx](file:///c:/Users/HP/Desktop/my-expo-app/src/navigation/MainTabNavigator.tsx)
Bottom tab navigator matching the website's mobile nav: Home, Orders, Rates, Wallet, Profile.

#### [NEW] [navigation/types.ts](file:///c:/Users/HP/Desktop/my-expo-app/src/navigation/types.ts)
TypeScript type definitions for all navigation params.

---

### Phase 5: Screen Migration (26 screens)

Each web screen needs these transformations:
- `<div>` → `<View>`, `<span>/<p>/<h1>` → `<Text>`, `<img>` → `<Image>`
- `<button>` → `<TouchableOpacity>` or `<Pressable>`
- `<input>` → `<TextInput>`
- `<select>` → Custom picker or `@react-native-picker/picker`
- `className="..."` → `className="..."` (NativeWind handles this)
- `onClick` → `onPress`
- `framer-motion` → `react-native-reanimated` for animations
- `lucide-react` → `lucide-react-native`
- `fetch('/api/...')` → `api.get/post(...)` using centralized API client
- Remove all `window.*`, `document.*`, `navigator.*` references

#### Auth Screens
| Screen | File | Key Changes |
|--------|------|-------------|
| Splash | [NEW] `src/screens/SplashScreen.tsx` | Replace `motion/react` with Reanimated. Replace HTML divs with RN Views. |
| Onboarding | [NEW] `src/screens/OnboardingScreen.tsx` | Use `FlatList` horizontal paging instead of AnimatePresence. |
| Login | [NEW] `src/screens/LoginScreen.tsx` | Remove reCAPTCHA. Use Firebase native phone auth. Replace `<form>` with `<View>`. Google sign-in via `expo-auth-session`. |
| Signup | [NEW] `src/screens/SignupScreen.tsx` | Replace `<form>` + `<select>` with RN primitives. Multi-step form with navigation. |

#### Main Screens
| Screen | File | Key Changes |
|--------|------|-------------|
| Dashboard | [NEW] `src/screens/DashboardScreen.tsx` | Grid → `FlatList`. Status cards as RN components. Quick actions grid. |
| Orders | [NEW] `src/screens/OrdersScreen.tsx` | Large screen (96KB web). `FlatList` with pull-to-refresh. Filters in `BottomSheet`. |
| CreateShipment | [NEW] `src/screens/CreateShipmentScreen.tsx` | Largest screen (94KB web). Multi-step form. Address autocomplete → Google Places. |
| CreateReverseShipment | [NEW] `src/screens/CreateReverseShipmentScreen.tsx` | Similar to CreateShipment. Image upload via `expo-image-picker`. |
| RateCalculator | [NEW] `src/screens/RateCalculatorScreen.tsx` | Form + results list. Pincode lookup via API. |
| Tracking | [NEW] `src/screens/TrackingScreen.tsx` | Timeline view with Reanimated animations. |
| Wallet | [NEW] `src/screens/WalletScreen.tsx` | Balance card + transaction list. Razorpay integration for recharge. |
| Profile | [NEW] `src/screens/ProfileScreen.tsx` | User info display + edit. Warehouse management. |
| Settings | [NEW] `src/screens/SettingsScreen.tsx` | Notification toggles, theme, warehouse addresses. |
| Support | [NEW] `src/screens/SupportScreen.tsx` | Chat-like interface. Uses `/api/support/chat`. |
| Notifications | [NEW] `src/screens/NotificationsScreen.tsx` | List of notifications from Firestore. |
| Billing | [NEW] `src/screens/BillingScreen.tsx` | Invoice list and download. |
| B2bCargo | [NEW] `src/screens/B2bCargoScreen.tsx` | B2B shipment form. |
| WeightDiscrepancy | [NEW] `src/screens/WeightDiscrepancyScreen.tsx` | Dispute list + raise dispute flow. |
| Returns | [NEW] `src/screens/ReturnsScreen.tsx` | Returns list + create reverse shipment. |
| NDR | [NEW] `src/screens/NdrScreen.tsx` | NDR list with action buttons. |
| Channels | [NEW] `src/screens/ChannelsScreen.tsx` | Shopify/WooCommerce integration setup. |
| CourierPerformance | [NEW] `src/screens/CourierPerformanceScreen.tsx` | Charts → `react-native-chart-kit` or `victory-native`. |
| BulkUpload | [NEW] `src/screens/BulkUploadScreen.tsx` | File picker via `expo-document-picker`. CSV parsing. |
| CodRemittance | [NEW] `src/screens/CodRemittanceScreen.tsx` | COD collection tracking. |
| AdminPanel | [NEW] `src/screens/AdminPanelScreen.tsx` | (If included) Admin-only screen behind role check. |
| ApiDocs | [NEW] `src/screens/ApiDocsScreen.tsx` | API documentation viewer. |

---

### Phase 6: Shared Components

#### [NEW] `src/components/Logo.tsx`
Port SVG logo using `react-native-svg`.

#### [NEW] `src/components/CourierLogo.tsx`
Port courier logo component.

#### [NEW] `src/components/ScannerModal.tsx`
Replace `html5-qrcode` with `expo-barcode-scanner`.

#### [NEW] `src/components/AddressAutocomplete.tsx`
Replace Google Maps web component with Google Places Autocomplete for RN.

#### [NEW] `src/components/AddOrderModal.tsx`
Convert modal to React Navigation modal or `BottomSheet`.

#### [NEW] `src/components/LoadingSpinner.tsx`
New shared loading component with Reanimated animation.

#### [NEW] `src/components/EmptyState.tsx`
Reusable empty state placeholder.

#### [MODIFY] [App.tsx](file:///c:/Users/HP/Desktop/my-expo-app/App.tsx)
Replace current content with Redux Provider + Navigation Container + Root Navigator.

---

## Verification Plan

### Automated Tests
```bash
# TypeScript compilation
npx tsc --noEmit

# Lint check
npm run lint

# Start Expo and verify no runtime crashes
npx expo start
```

### Manual Verification
- Run on Android emulator via `npx expo start --android`
- Verify auth flow: Splash → Onboarding → Login → Dashboard
- Verify bottom tab navigation works
- Verify API calls work with absolute base URL
- Verify Firebase Firestore real-time listeners work
- Test form inputs on CreateShipment screen
- Verify deep linking / navigation state persistence

---

## Migration Priority Order

Given the massive scope (26 screens, 600KB+ of web code), I recommend migrating in this order:

1. **Phase 1-2**: Foundation + Infrastructure (get Firebase, API client, storage working)
2. **Phase 3**: Redux store setup
3. **Phase 4**: Navigation skeleton with placeholder screens
4. **Phase 5a**: Auth screens (Splash, Onboarding, Login, Signup) — **this makes the app usable**
5. **Phase 5b**: Core screens (Dashboard, Orders, CreateShipment, RateCalculator, Wallet, Profile)
6. **Phase 5c**: Secondary screens (Tracking, Returns, NDR, Settings, etc.)
7. **Phase 5d**: Advanced screens (Channels, AdminPanel, BulkUpload, etc.)
8. **Phase 6**: Polish, animations, performance optimization

> [!TIP]
> Each phase will produce a working app. We can ship Phase 5a as an MVP and iterate.
