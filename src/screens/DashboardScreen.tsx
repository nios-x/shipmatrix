import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Text } from '../components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { Logo } from '../components/Logo';
import { api, routes } from '../lib/api';
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
  // B2B Cargo & Bulk Shipping used to have a slot here. Pulled until there's a
  // real rate card and a wallet debit for it — see B2bCargoScreen.tsx, which
  // now shows a "contact sales" state rather than a form that can only fail.
];

function HeroPromoCarousel({ navigation }: { navigation: any }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<any>(null);
  // Mirrors activeIndex so the timer can read the current slide without the
  // effect resubscribing on every change.
  const indexRef = useRef(0);

  // Auto-play carousel
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % CAROUSEL_SLIDES.length;
      indexRef.current = nextIndex;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CAROUSEL_WIDTH);
    if (index >= 0 && index < CAROUSEL_SLIDES.length && index !== activeIndex) {
      indexRef.current = index;
      setActiveIndex(index);
    }
  };

  // Every slide is exactly CAROUSEL_WIDTH wide, so an index's offset is known
  // without measuring it — which is what scrollToIndex needs to reach a slide
  // that has not been rendered yet.
  const getItemLayout = (_: ArrayLike<CarouselSlide> | null | undefined, index: number) => ({
    length: CAROUSEL_WIDTH,
    offset: CAROUSEL_WIDTH * index,
    index,
  });

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
        getItemLayout={getItemLayout}
        renderItem={({ item }) => (
          <View style={{ width: CAROUSEL_WIDTH }} className="w-[90%] px-1 py-1">
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => item.action(navigation)}
              className="overflow-hidden rounded-3xl  shadow-md shadow-indigo-950/20">
              <LinearGradient
                colors={item.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className=" relative min-h-[190px] justify-between">
                {/* Top Tag & Decorative Icon */}
                <View className="flex-row items-center justify-between pb-3 pl-4 pr-3 pt-3">
                  <View
                    style={{ backgroundColor: item.badgeBg }}
                    className=" flex-row items-center gap-1.5 rounded-full px-4 py-1.5">
                    <Feather name={item.tagIcon} size={12} color={item.badgeTextColor} />
                    <Text
                      style={{ color: item.badgeTextColor }}
                      className="font-black text-[10px] uppercase tracking-wider">
                      {item.tag}
                    </Text>
                  </View>

                  <View className="h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <Feather name="arrow-up-right" size={15} color="#FFFFFF" />
                  </View>
                </View>

                {/* Title & Description */}
                <View className="">
                  <Text className="px-4 font-black text-xl leading-6 tracking-tight text-white">
                    {item.title}
                  </Text>
                  <Text
                    className="mt-1.5 px-4 font-medium text-xs leading-5 text-white/85"
                    numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>

                {/* Bottom CTA Bar */}
                <View className="flex-row items-center justify-between p-4  pt-3">
                  <View className="flex-row items-center gap-1.5 rounded-xl bg-white px-4 py-2 shadow-sm">
                    <Text className="font-black text-xs text-slate-900">{item.ctaText}</Text>
                    <Feather name="arrow-right" size={13} color="#0F172A" />
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <Feather name="shield" size={12} color="rgba(255,255,255,0.75)" />
                    <Text className="font-bold text-[10px] text-white/75">ShipMatrix Verified</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Pagination Dots */}
      <View className="mt-3.5 flex-row items-center justify-center gap-1.5">
        {CAROUSEL_SLIDES.map((_, i) => {
          const isActive = i === activeIndex;
          return (
            <View
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive ? 'w-6 bg-violet-600' : 'w-1.5 bg-slate-200'
              }`}
            />
          );
        })}
      </View>
    </View>
  );
}

function StatusCard({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <LinearGradient
      colors={['#ffffff', '#f8f7ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-full border border-violet-100/80"
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
      }}>
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className={`h-2.5 w-2.5 rounded-full ${color}`} />

            <Text className="font-raleway-bold text-[11px] uppercase tracking-wider text-gray-500">
              {title}
            </Text>
          </View>

          <View className="rounded-full border border-violet-100/60 bg-violet-50 px-2 py-0.5">
            <Text className="font-raleway-bold text-[9px] uppercase tracking-wider text-violet-600">
              Status
            </Text>
          </View>
        </View>

        {/* Count */}
        <View className="mt-4 flex-row items-baseline justify-between">
          <Text className="font-raleway-black text-[36px] leading-none tracking-tight text-gray-950">
            {count}
          </Text>

          <Text className="font-raleway text-[11px] text-gray-400">Total</Text>
        </View>

        {/* Progress */}
        <View className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <LinearGradient
            colors={['#8b5cf6', '#6366f1', '#06b6d4']}
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="w-[22%] items-center gap-2">
      <View
        className={`h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 ${bgColor} shadow-xs`}>
        <Feather name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text
        className="text-center font-bold text-[11px] tracking-tight text-slate-700"
        numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
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
          api.post(routes.syncTracking(s.awb!), { courier: s.courier }).catch(() => null)
        )
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-row items-center gap-2.5">
          <Logo size={34} />
          <View>
            <Text className="font-raleway-black text-[19px] leading-[22px] tracking-tight text-slate-900">
              ShipMatrix
            </Text>
            <Text className="font-raleway-medium text-[11px] leading-[15px] text-slate-500">
              Multi-Courier Logistics Platform
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
          className="h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
          <Feather name="bell" size={17} color="#7C3AED" />
          {unreadCount > 0 && (
            <View className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1">
              <Text className="font-black text-[9px] text-white">
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
        }>
        {/* Dynamic Hero Carousel */}
        <HeroPromoCarousel navigation={navigation} />

        {/* Courier Partners Strip */}
        <View className="shadow-xs mb-6 rounded-2xl border border-slate-100 bg-white px-4 py-2.5">
          <View className="flex-row items-center justify-between">
            {['DELHIVERY', 'BLUEDART', 'XPRESSBEES', 'SHADOWFAX', 'EKART'].map((name, i) => (
              <React.Fragment key={name}>
                <Text className="font-black text-[10px] tracking-wider text-slate-800">{name}</Text>
                {i < 4 && <View className="h-1 w-1 rounded-full bg-slate-300" />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Status Cards */}
        <View className="mb-6 gap-3">
          {/* Row 1 */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatusCard title="Booked" count={statusCounts.booked} color="bg-blue-500" />
            </View>

            <View className="flex-1">
              <StatusCard title="In Transit" count={statusCounts.inTransit} color="bg-amber-500" />
            </View>
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatusCard title="Delivered" count={statusCounts.delivered} color="bg-green-500" />
            </View>

            <View className="flex-1">
              <StatusCard title="NDR / RTO" count={statusCounts.ndr} color="bg-red-500" />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-4">
          <View className="mb-3.5 flex-row items-center justify-between px-1">
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Quick Actions
            </Text>
            <Text className="font-bold text-[10px] uppercase tracking-wide text-violet-700">
              10 Shortcuts
            </Text>
          </View>

          <View className="shadow-xs flex-row flex-wrap justify-between gap-y-4 rounded-3xl border border-slate-100 bg-white p-4">
            <QuickAction
              title="Ship Now"
              iconName="send"
              bgColor="bg-violet-50"
              iconColor="#7C3AED"
              onPress={() => {
                (navigation as any).getParent()?.navigate('OrdersTab', {
                  screen: 'CreateShipment',
                  initial: false,
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

            <QuickAction
              title="Performance"
              iconName="bar-chart-2"
              bgColor="bg-emerald-50"
              iconColor="#059669"
              onPress={() => navigation.navigate('CourierPerformance')}
            />

            <QuickAction
              title="Parcel Size"
              iconName="camera"
              bgColor="bg-cyan-50"
              iconColor="#0891B2"
              onPress={() =>
                (navigation as any).getParent()?.navigate('RatesTab', {
                  screen: 'RateCalculator',
                  params: { scan: Date.now() },
                })
              }
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
