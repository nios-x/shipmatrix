import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { useShipments } from '../lib/useShipments';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
import { useNotifications } from '../lib/useNotifications';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';
import {
  realShipments,
  isBooked,
  isInTransit,
  isDelivered,
  isNdr,
  isRto,
  isActive,
} from '../lib/shipments';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32; // 16px padding on each side

interface CarouselSlide {
  id: string;
  tag: string;
  tagIcon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  ctaText: string;
  gradientColors: readonly [string, string, ...string[]];
  badgeBg: string;
  badgeTextColor: string;
  action: (navigation: any) => void;
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: '1',
    tag: 'RATE ENGINE',
    tagIcon: 'zap',
    title: 'Save up to 40% on Shipping',
    description: 'Compare live freight rates from Delhivery, Ekart, Shadowfax & Xpressbees.',
    ctaText: 'Calculate Rates',
    gradientColors: ['#4F46E5', '#7C3AED', '#9333EA'] as const,
    badgeBg: 'rgba(255, 255, 255, 0.2)',
    badgeTextColor: '#FFFFFF',
    action: (nav) => {
      nav.getParent()?.navigate('RatesTab', { screen: 'RateCalculator' });
    },
  },
  {
    id: '2',
    tag: 'REAL-TIME TRACKING',
    tagIcon: 'map-pin',
    title: 'Live Tracking & NDR Guard',
    description: 'Track AWB checkpoints in real-time and automate delivery attempts.',
    ctaText: 'Track Shipment',
    gradientColors: ['#0F172A', '#1E293B', '#334155'] as const,
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    badgeTextColor: '#38BDF8',
    action: (nav) => {
      nav.navigate('Tracking', {});
    },
  },
  {
    id: '3',
    tag: 'INSTANT DISPATCH',
    tagIcon: 'credit-card',
    title: 'Prepaid Wallet & Fast Pickup',
    description: 'Recharge your wallet and get free scheduled doorstep pickups across India.',
    ctaText: 'Recharge Wallet',
    gradientColors: ['#059669', '#0D9488', '#0284C7'] as const,
    badgeBg: 'rgba(255, 255, 255, 0.2)',
    badgeTextColor: '#FFFFFF',
    action: (nav) => {
      nav.getParent()?.navigate('WalletTab', { screen: 'Wallet' });
    },
  },
  {
    id: '4',
    tag: 'HEAVY LOGISTICS',
    tagIcon: 'truck',
    title: 'B2B Cargo & Bulk Shipping',
    description: 'Dedicated linehauls, LTL logistics and discounted freight for 50kg+ shipments.',
    ctaText: 'Explore B2B',
    gradientColors: ['#D97706', '#EA580C', '#C2410C'] as const,
    badgeBg: 'rgba(255, 255, 255, 0.2)',
    badgeTextColor: '#FFFFFF',
    action: (nav) => {
      nav.navigate('B2bCargo');
    },
  },
];

function HeroPromoCarousel({ navigation }: { navigation: any }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<any>(null);

  // Auto-play carousel
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % CAROUSEL_SLIDES.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CAROUSEL_WIDTH);
    if (index >= 0 && index < CAROUSEL_SLIDES.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <View className="mb-6">
      <FlatList
        ref={flatListRef}
        data={CAROUSEL_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={CAROUSEL_WIDTH}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={{ width: CAROUSEL_WIDTH }} className="px-1 py-1 w-[90%]">
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => item.action(navigation)}
              className="rounded-3xl overflow-hidden  shadow-md shadow-indigo-950/20"
            >
              <LinearGradient
                colors={item.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className=" justify-between min-h-[190px] relative"
              >
                {/* Top Tag & Decorative Icon */}
                <View className="flex-row items-center justify-between pt-3 pl-4 pr-3 pb-3">
                  <View
                    style={{ backgroundColor: item.badgeBg }}
                    className=" py-1.5 rounded-full flex-row items-center gap-1.5 px-4"
                  >
                    <Feather name={item.tagIcon} size={12} color={item.badgeTextColor} />
                    <Text
                      style={{ color: item.badgeTextColor }}
                      className="text-[10px] font-black uppercase tracking-wider"
                    >
                      {item.tag}
                    </Text>
                  </View>

                  <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center">
                    <Feather name="arrow-up-right" size={15} color="#FFFFFF" />
                  </View>
                </View>

                {/* Title & Description */}
                <View className="">
                  <Text className="text-xl font-black text-white tracking-tight leading-6 px-4">
                    {item.title}
                  </Text>
                  <Text className="text-xs text-white/85 font-medium mt-1.5 leading-5 px-4" numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>

                {/* Bottom CTA Bar */}
                <View className="flex-row items-center justify-between pt-3  p-4">
                  <View className="bg-white px-4 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm">
                    <Text className="text-xs font-black text-slate-900">
                      {item.ctaText}
                    </Text>
                    <Feather name="arrow-right" size={13} color="#0F172A" />
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <Feather name="shield" size={12} color="rgba(255,255,255,0.75)" />
                    <Text className="text-[10px] font-bold text-white/75">
                      ShipMatrix Verified
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Pagination Dots */}
      <View className="flex-row items-center justify-center gap-1.5 mt-3.5">
        {CAROUSEL_SLIDES.map((_, i) => {
          const isActive = i === activeIndex;
          return (
            <View
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? 'w-6 bg-violet-600' : 'w-1.5 bg-slate-200'
                }`}
            />
          );
        })}
      </View>
    </View>
  );
}

function StatusCard({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <LinearGradient
      colors={["#ffffff", "#f8f7ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-full border border-violet-100/80"
      style={{
        borderRadius: 22,
        overflow: "hidden",
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className={`h-2.5 w-2.5 rounded-full ${color}`} />

            <Text className="text-[11px] font-raleway-bold uppercase tracking-wider text-gray-500">
              {title}
            </Text>
          </View>

          <View className="rounded-full bg-violet-50 px-2 py-0.5 border border-violet-100/60">
            <Text className="text-[9px] font-raleway-bold uppercase tracking-wider text-violet-600">
              Status
            </Text>
          </View>
        </View>

        {/* Count */}
        <View className="mt-4 flex-row items-baseline justify-between">
          <Text className="text-[36px] font-raleway-black leading-none tracking-tight text-gray-950">
            {count}
          </Text>

          <Text className="text-[11px] font-raleway text-gray-400">
            Total
          </Text>
        </View>

        {/* Progress */}
        <View className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <LinearGradient
            colors={["#8b5cf6", "#6366f1", "#06b6d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-full w-[65%] rounded-full"
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function QuickAction({
  title,
  iconName,
  bgColor,
  iconColor,
  onPress,
}: {
  title: string;
  iconName: string;
  bgColor: string;
  iconColor: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center gap-2 w-[22%]"
    >
      <View
        className={`w-14 h-14 rounded-2xl items-center justify-center border border-slate-100 ${bgColor} shadow-xs`}
      >
        <Feather name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text
        className="text-[11px] font-bold text-slate-700 tracking-tight text-center"
        numberOfLines={1}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { shipments } = useShipments();
  const { unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const statusCounts = useMemo(() => {
    const real = realShipments(shipments);
    return {
      booked: real.filter(isBooked).length,
      inTransit: real.filter(isInTransit).length,
      delivered: real.filter(isDelivered).length,
      ndr: real.filter((s) => isNdr(s) || isRto(s)).length,
    };
  }, [shipments]);

  /** Refreshes tracking for in-flight shipments; the listener updates the UI. */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const active = shipments.filter((s) => s.awb && isActive(s)).slice(0, 20);
      await Promise.all(
        active.map((s) =>
          api.post(`/api/v1/shipments/sync/${s.awb}`, { courier: s.courier }).catch(() => null)
        )
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <Logo size={34} />
          <View>
            <Text className="text-[19px] leading-[22px] font-raleway-black text-slate-900 tracking-tight">
              ShipMatrix
            </Text>
            <Text className="text-[11px] leading-[15px] font-raleway-medium text-slate-500">
              Multi-Courier Logistics Platform
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-xl bg-violet-50 items-center justify-center border border-violet-100"
        >
          <Feather name="bell" size={17} color="#7C3AED" />
          {unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 items-center justify-center border-2 border-white">
              <Text className="text-[9px] font-black text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-3"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7C3AED']}
            tintColor="#7C3AED"
          />
        }
      >
        {/* Dynamic Hero Carousel */}
        <HeroPromoCarousel navigation={navigation} />

        {/* Courier Partners Strip */}
        <View className="bg-white border border-slate-100 rounded-2xl py-2.5 px-4 mb-6 shadow-xs">
          <View className="flex-row items-center justify-between">
            {['DELHIVERY', 'BLUEDART', 'XPRESSBEES', 'SHADOWFAX', 'EKART'].map(
              (name, i) => (
                <React.Fragment key={name}>
                  <Text className="font-black text-slate-800 text-[10px] tracking-wider">
                    {name}
                  </Text>
                  {i < 4 && (
                    <View className="w-1 h-1 rounded-full bg-slate-300" />
                  )}
                </React.Fragment>
              )
            )}
          </View>
        </View>

        {/* Status Cards */}
        <View className="gap-3 mb-6">
          {/* Row 1 */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatusCard
                title="Booked"
                count={statusCounts.booked}
                color="bg-blue-500"
              />
            </View>

            <View className="flex-1">
              <StatusCard
                title="In Transit"
                count={statusCounts.inTransit}
                color="bg-amber-500"
              />
            </View>
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatusCard
                title="Delivered"
                count={statusCounts.delivered}
                color="bg-green-500"
              />
            </View>

            <View className="flex-1">
              <StatusCard
                title="NDR / RTO"
                count={statusCounts.ndr}
                color="bg-red-500"
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-4">
          <View className="mb-3.5 flex-row items-center justify-between px-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Quick Actions
            </Text>
            <Text className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">
              8 Shortcuts
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            <QuickAction
              title="Ship Now"
              iconName="send"
              bgColor="bg-violet-50"
              iconColor="#7C3AED"
              onPress={() => {
                (navigation as any).getParent()?.navigate('OrdersTab', {
                  screen: 'CreateShipment',
                });
              }}
            />

            <QuickAction
              title="Bulk Upload"
              iconName="upload"
              bgColor="bg-pink-50"
              iconColor="#EC4899"
              onPress={() => navigation.navigate('BulkUpload')}
            />

            <QuickAction
              title="B2B Cargo"
              iconName="truck"
              bgColor="bg-amber-50"
              iconColor="#F59E0B"
              onPress={() => navigation.navigate('B2bCargo')}
            />

            <QuickAction
              title="Track AWB"
              iconName="search"
              bgColor="bg-sky-50"
              iconColor="#0284C7"
              onPress={() => navigation.navigate('Tracking', {})}
            />

            <QuickAction
              title="Returns"
              iconName="rotate-ccw"
              bgColor="bg-emerald-50"
              iconColor="#10B981"
              onPress={() => {
                (navigation as any).getParent()?.navigate('ProfileTab', {
                  screen: 'Returns',
                });
              }}
            />

            <QuickAction
              title="Weight Dis."
              iconName="sliders"
              bgColor="bg-violet-50"
              iconColor="#7C3AED"
              onPress={() => navigation.navigate('WeightDiscrepancy')}
            />

            <QuickAction
              title="Channels"
              iconName="shopping-cart"
              bgColor="bg-indigo-50"
              iconColor="#6366F1"
              onPress={() => navigation.navigate('Channels')}
            />

            <QuickAction
              title="NDR Center"
              iconName="alert-circle"
              bgColor="bg-rose-50"
              iconColor="#EF4444"
              onPress={() => navigation.navigate('Ndr')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
