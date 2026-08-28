import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GlassTabBar from './GlassTabBar';
import type {
  MainTabParamList,
  HomeStackParamList,
  OrdersStackParamList,
  RatesStackParamList,
  WalletStackParamList,
  ProfileStackParamList,
} from './types';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import CreateShipmentScreen from '../screens/CreateShipmentScreen';
import CreateReverseShipmentScreen from '../screens/CreateReverseShipmentScreen';
import RateCalculatorScreen from '../screens/RateCalculatorScreen';
import AvailableCouriersScreen from '../screens/AvailableCouriersScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrackingScreen from '../screens/TrackingScreen';
import BulkUploadScreen from '../screens/BulkUploadScreen';
import B2bCargoScreen from '../screens/B2bCargoScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CourierPerformanceScreen from '../screens/CourierPerformanceScreen';
import ChannelsScreen from '../screens/ChannelsScreen';
import NdrScreen from '../screens/NdrScreen';
import WeightDiscrepancyScreen from '../screens/WeightDiscrepancyScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportScreen from '../screens/SupportScreen';
import ApiDocsScreen from '../screens/ApiDocsScreen';
import BillingScreen from '../screens/BillingScreen';
import CodRemittanceScreen from '../screens/CodRemittanceScreen';
import ReturnsScreen from '../screens/ReturnsScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';

// ─── Stack Navigators ───────────────────────────────────
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="Tracking" component={TrackingScreen} />
      <HomeStack.Screen name="BulkUpload" component={BulkUploadScreen} />
      <HomeStack.Screen name="B2bCargo" component={B2bCargoScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStack.Screen name="CourierPerformance" component={CourierPerformanceScreen} />
      <HomeStack.Screen name="Channels" component={ChannelsScreen} />
      <HomeStack.Screen name="Ndr" component={NdrScreen} />
      <HomeStack.Screen name="WeightDiscrepancy" component={WeightDiscrepancyScreen} />
      <HomeStack.Screen name="AvailableCouriers" component={AvailableCouriersScreen} />
    </HomeStack.Navigator>
  );
}

const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
function OrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="Orders" component={OrdersScreen} />
      <OrdersStack.Screen name="CreateShipment" component={CreateShipmentScreen} />
      <OrdersStack.Screen name="CreateReverseShipment" component={CreateReverseShipmentScreen} />
    </OrdersStack.Navigator>
  );
}

const RatesStack = createNativeStackNavigator<RatesStackParamList>();
function RatesStackNavigator() {
  return (
    <RatesStack.Navigator screenOptions={{ headerShown: false }}>
      <RatesStack.Screen name="RateCalculator" component={RateCalculatorScreen} />
      <RatesStack.Screen name="AvailableCouriers" component={AvailableCouriersScreen} />
    </RatesStack.Navigator>
  );
}

const WalletStack = createNativeStackNavigator<WalletStackParamList>();
function WalletStackNavigator() {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="Wallet" component={WalletScreen} />
      <WalletStack.Screen name="Billing" component={BillingScreen} />
      <WalletStack.Screen name="CodRemittance" component={CodRemittanceScreen} />
    </WalletStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
      <ProfileStack.Screen name="Support" component={SupportScreen} />
      <ProfileStack.Screen name="ApiDocs" component={ApiDocsScreen} />
      <ProfileStack.Screen name="Returns" component={ReturnsScreen} />
      <ProfileStack.Screen name="AdminPanel" component={AdminPanelScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab Navigator ──────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}>
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="OrdersTab" component={OrdersStackNavigator} />
      <Tab.Screen name="RatesTab" component={RatesStackNavigator} />
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
