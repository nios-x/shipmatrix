import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

function GlassTabBarBackground() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          overflow: 'hidden',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.35)' : 'transparent',
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              } as any)
            : {}),
        },
      ]}
      pointerEvents="none"
    >
      {/* Native Frosted Glass Blur layer */}
      <BlurView
        tint="light"
        intensity={95}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        blurReductionFactor={4}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ─── Tab Navigator ──────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  HomeTab: 'home',
  OrdersTab: 'package',
  RatesTab: 'percent',
  WalletTab: 'credit-card',
  ProfileTab: 'user',
};

const TAB_LABEL_MAP: Record<string, string> = {
  HomeTab: 'Home',
  OrdersTab: 'Orders',
  RatesTab: 'Rates',
  WalletTab: 'Wallet',
  ProfileTab: 'Profile',
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarIcon: ({ focused, color }) => {
          const iconName = TAB_ICON_MAP[route.name] || 'circle';
          return (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 46,
                height: 30,
                borderRadius: 15,
                backgroundColor: focused ? 'rgba(124, 58, 237, 0.12)' : 'transparent',
                borderWidth: focused ? 1 : 0,
                borderColor: focused ? 'rgba(124, 58, 237, 0.22)' : 'transparent',
              }}
            >
              <Feather name={iconName} size={18} color={color} />
            </View>
          );
        },
        tabBarLabel: ({ focused, color }) => (
          <Text
            style={{
              fontFamily:
                Platform.OS === 'web'
                  ? 'Raleway'
                  : focused
                  ? 'Raleway_700Bold'
                  : 'Raleway_600SemiBold',
              fontSize: 10,
              fontWeight: focused ? '700' : '600',
              color,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: 1,
            }}
          >
            {TAB_LABEL_MAP[route.name]}
          </Text>
        ),
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          height: Platform.OS === 'ios' ? 88 : 70,
          shadowColor: '#4f46e5',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="OrdersTab" component={OrdersStackNavigator} />
      <Tab.Screen name="RatesTab" component={RatesStackNavigator} />
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
