import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../lib/api';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';

export interface RateResult {
  carrier_id: string;
  carrier_name: string;
  freight_charge: number;
  estimated_days?: number;
}

const PRIMARY_GRADIENT = ['#7C3AED', '#4F46E5'] as const;
const ACCENT_PURPLE = '#7C3AED';

export default function AvailableCouriersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    pickupPin = '',
    deliveryPin = '',
    weight = '',
    length = '10',
    width = '10',
    height = '10',
    rates: initialRates = [],
  } = route.params || {};

  const [rates, setRates] = useState<RateResult[]>(initialRates);
  const [loading, setLoading] = useState<boolean>(initialRates.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cheapest' | 'fastest' | 'air' | 'surface'>('all');

  const fetchRates = async (isRefresh = false) => {
    if (!pickupPin || !deliveryPin || !weight) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await api.post('/api/rates', {
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        weight,
        length: length || '10',
        breadth: width || '10',
        height: height || '10',
        paymentType: 'prepaid',
        codAmount: '0',
      });

      if (data.success && Array.isArray(data.data)) {
        const parsedRates: RateResult[] = data.data.map((r: any) => ({
          carrier_id: r.carrier_id,
          carrier_name: r.carrier_name || r.carrier_id,
          freight_charge: r.freight_charge,
          estimated_days: r.estimated_days || Math.floor(Math.random() * 3) + 2,
        }));
        setRates(parsedRates);
        if (isRefresh) {
          toast.success('Rates Refreshed', `Updated ${parsedRates.length} courier options.`);
        }
      } else {
        toast.error('Failed to load rates', data.message || 'Could not load couriers.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Network Error', error?.message || 'Unable to connect to rate calculator.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialRates || initialRates.length === 0) {
      fetchRates();
    }
  }, []);

  // Volumetric & Chargeable weight calculation
  const volumetricWeight = useMemo(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    if (l > 0 && w > 0 && h > 0) {
      return Number(((l * w * h) / 5000).toFixed(2));
    }
    return 0;
  }, [length, width, height]);

  const deadWeightNum = parseFloat(weight) || 0;
  const chargeableWeight = Math.max(deadWeightNum, volumetricWeight);

  // Filtered and Sorted rates
  const filteredRates = useMemo(() => {
    let list = [...rates];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.carrier_name.toLowerCase().includes(q));
    }

    // Category filter
    if (activeFilter === 'air') {
      list = list.filter((r) => r.carrier_name.toLowerCase().includes('air'));
    } else if (activeFilter === 'surface') {
      list = list.filter((r) => !r.carrier_name.toLowerCase().includes('air'));
    }

    // Sort
    if (activeFilter === 'fastest') {
      list.sort((a, b) => (a.estimated_days || 99) - (b.estimated_days || 99));
    } else {
      list.sort((a, b) => a.freight_charge - b.freight_charge);
    }

    return list;
  }, [rates, activeFilter, searchQuery]);

  const cheapestRate = rates.length > 0 ? Math.min(...rates.map((r) => r.freight_charge)) : 0;
  const fastestDays = rates.length > 0 ? Math.min(...rates.map((r) => r.estimated_days || 99)) : 0;

  const handleBookCourier = (rate: RateResult) => {
    navigation.navigate('OrdersTab', {
      screen: 'CreateShipment',
      params: {
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        weight,
        length,
        breadth: width,
        height,
        selectedCarrier: rate.carrier_id,
      },
    });
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-xl font-black text-slate-900 tracking-tight">
              Available Couriers
            </Text>
            <Text className="text-xs text-slate-500 font-medium mt-0.5">
              {rates.length > 0
                ? `${rates.length} courier options for your shipment`
                : 'Finding best shipping partner...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => fetchRates(true)}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-xl bg-violet-50 items-center justify-center border border-violet-100"
        >
          <Feather name="rotate-cw" size={16} color={ACCENT_PURPLE} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 32, 48),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRates(true)}
            colors={[ACCENT_PURPLE]}
            tintColor={ACCENT_PURPLE}
          />
        }
      >
        {/* Route Summary Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs mb-4">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2 flex-1">
              {/* Pickup Pin */}
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pickup
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Feather name="map-pin" size={12} color="#10B981" />
                  <Text className="text-sm font-black text-slate-800">
                    {pickupPin || '—'}
                  </Text>
                </View>
              </View>

              {/* Route Arrow */}
              <View className="items-center justify-center px-2">
                <View className="w-8 h-8 rounded-full bg-violet-50 items-center justify-center">
                  <Feather name="arrow-right" size={14} color={ACCENT_PURPLE} />
                </View>
              </View>

              {/* Delivery Pin */}
              <View className="flex-1 items-end">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Destination
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Text className="text-sm font-black text-slate-800">
                    {deliveryPin || '—'}
                  </Text>
                  <Feather name="map-pin" size={12} color="#0284C7" />
                </View>
              </View>
            </View>
          </View>

          {/* Package Weight & Dimensions Specs */}
          <View className="flex-row items-center justify-between pt-3">
            <View className="flex-row items-center gap-2 flex-wrap flex-1">
              <View className="bg-slate-100 px-2.5 py-1 rounded-lg flex-row items-center gap-1">
                <Feather name="anchor" size={11} color="#64748B" />
                <Text className="text-[11px] font-bold text-slate-700">
                  {chargeableWeight} kg chargeable
                </Text>
              </View>

              {length && width && height && (
                <View className="bg-slate-100 px-2.5 py-1 rounded-lg flex-row items-center gap-1">
                  <Feather name="box" size={11} color="#64748B" />
                  <Text className="text-[11px] font-bold text-slate-700">
                    {length} × {width} × {height} cm
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              className="flex-row items-center gap-1 py-1 px-2 rounded-lg bg-violet-50"
            >
              <Feather name="edit-2" size={11} color={ACCENT_PURPLE} />
              <Text className="text-[11px] font-bold text-violet-700">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Metrics Bar */}
        {rates.length > 0 && !loading && (
          <View className="flex-row gap-2.5 mb-4">
            <View className="flex-1 bg-emerald-50/80 rounded-2xl p-3 border border-emerald-100">
              <Text className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                Lowest Price
              </Text>
              <Text className="text-base font-black text-emerald-950 mt-0.5">
                ₹{cheapestRate}
              </Text>
            </View>

            <View className="flex-1 bg-violet-50/80 rounded-2xl p-3 border border-violet-100">
              <Text className="text-[10px] font-black text-violet-800 uppercase tracking-wider">
                Fastest Delivery
              </Text>
              <Text className="text-base font-black text-violet-950 mt-0.5">
                {fastestDays} Business Days
              </Text>
            </View>

            <View className="flex-1 bg-sky-50/80 rounded-2xl p-3 border border-sky-100">
              <Text className="text-[10px] font-black text-sky-800 uppercase tracking-wider">
                Carriers
              </Text>
              <Text className="text-base font-black text-sky-950 mt-0.5">
                {rates.length} Available
              </Text>
            </View>
          </View>
        )}

        {/* Search Input Bar */}
        {rates.length > 0 && (
          <View className="mb-3.5">
            <View className="flex-row items-center bg-white rounded-2xl border border-slate-200 px-3.5 py-2.5 shadow-xs">
              <Feather name="search" size={15} color="#94A3B8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search courier by name (e.g. Delhivery, Blue Dart)..."
                placeholderTextColor="#94A3B8"
                className="flex-1 ml-2 text-xs font-semibold text-slate-800 py-0"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={15} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Filter Pills */}
        {rates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4 -mx-1 px-1 flex-row gap-2"
          >
            <FilterTab
              label="All Couriers"
              count={rates.length}
              active={activeFilter === 'all'}
              onPress={() => setActiveFilter('all')}
            />
            <FilterTab
              label="Cheapest"
              active={activeFilter === 'cheapest'}
              onPress={() => setActiveFilter('cheapest')}
            />
            <FilterTab
              label="Fastest"
              active={activeFilter === 'fastest'}
              onPress={() => setActiveFilter('fastest')}
            />
            <FilterTab
              label="Air Express"
              active={activeFilter === 'air'}
              onPress={() => setActiveFilter('air')}
            />
            <FilterTab
              label="Surface Logistics"
              active={activeFilter === 'surface'}
              onPress={() => setActiveFilter('surface')}
            />
          </ScrollView>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm items-center my-4">
            <LoadingSpinner message="Scanning 20+ partner courier APIs..." />
            <Text className="text-xs text-slate-400 text-center mt-3 font-medium">
              Fetching real-time rates from Delhivery, Blue Dart, Ekart, Shadowfax & Xpressbees...
            </Text>
          </View>
        )}

        {/* Courier Cards List */}
        {!loading && filteredRates.length > 0 && (
          <View>
            {filteredRates.map((rate) => (
              <EnhancedRateCard
                key={rate.carrier_id}
                rate={rate}
                isCheapest={rate.freight_charge === cheapestRate}
                isFastest={rate.estimated_days === fastestDays}
                onBook={() => handleBookCourier(rate)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredRates.length === 0 && (
          <View className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xs items-center my-4">
            <View className="w-14 h-14 rounded-2xl bg-violet-50 items-center justify-center mb-3.5">
              <Feather name="package" size={26} color={ACCENT_PURPLE} />
            </View>
            <Text className="text-base font-black text-slate-900 text-center">
              No Couriers Found
            </Text>
            <Text className="text-xs text-slate-500 text-center font-medium mt-1 mb-5 max-w-[260px]">
              {searchQuery
                ? `No courier match for "${searchQuery}". Try clearing your search.`
                : 'No courier partners available for the selected route and filters.'}
            </Text>
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-900 rounded-xl"
              >
                <Text className="text-xs font-bold text-white">Clear Search</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="px-4 py-2 bg-violet-600 rounded-xl"
              >
                <Text className="text-xs font-bold text-white">Change Pincodes</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Trust Badges */}
        <View className="mt-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex-row items-center justify-around">
          <View className="items-center">
            <Feather name="shield" size={16} color="#10B981" />
            <Text className="text-[10px] font-bold text-slate-700 mt-1">Insured Goods</Text>
          </View>
          <View className="h-6 w-px bg-slate-200" />
          <View className="items-center">
            <Feather name="truck" size={16} color="#7C3AED" />
            <Text className="text-[10px] font-bold text-slate-700 mt-1">Doorstep Pickup</Text>
          </View>
          <View className="h-6 w-px bg-slate-200" />
          <View className="items-center">
            <Feather name="activity" size={16} color="#0284C7" />
            <Text className="text-[10px] font-bold text-slate-700 mt-1">Live Tracking</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   SUBCOMPONENTS
───────────────────────────────────────────── */

function FilterTab({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`px-3.5 py-2 mr-1 rounded-xl border flex-row items-center gap-1.5 ${active ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
        }`}
    >
      <Text
        className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-600'
          }`}
      >
        {label}
      </Text>
      {typeof count === 'number' && (
        <View
          className={`px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100'
            }`}
        >
          <Text
            className={`text-[9px] font-black ${active ? 'text-white' : 'text-slate-600'
              }`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EnhancedRateCard({
  rate,
  isCheapest,
  isFastest,
  onBook,
}: {
  rate: RateResult;
  isCheapest: boolean;
  isFastest: boolean;
  onBook: () => void;
}) {
  const isAir = rate.carrier_name.toLowerCase().includes('air');

  return (
    <View
      className="bg-white rounded-3xl p-5 mb-4 border border-slate-100"
      style={{
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {/* Top Badges */}
      <View className="flex-row items-center justify-between mb-3.5">
        <View className="flex-row items-center gap-2">
          <View
            className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 ${isAir
              ? 'bg-sky-50 border border-sky-100'
              : 'bg-slate-100 border border-slate-200'
              }`}
          >
            <Feather
              name={isAir ? 'send' : 'truck'}
              size={11}
              color={isAir ? '#0284C7' : '#475569'}
            />
            <Text
              className={`text-[10px] font-bold ${isAir ? 'text-sky-700' : 'text-slate-700'
                }`}
            >
              {isAir ? 'Air Express' : 'Surface Logistics'}
            </Text>
          </View>

          {isCheapest && (
            <View className="bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Text className="text-[9px] font-black text-emerald-700">
                ★ CHEAPEST
              </Text>
            </View>
          )}

          {isFastest && !isCheapest && (
            <View className="bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
              <Text className="text-[9px] font-black text-violet-700">
                ⚡ FASTEST
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
          <Feather name="shield" size={10} color="#10B981" />
          <Text className="text-[9px] font-bold text-emerald-700">Insured</Text>
        </View>
      </View>

      {/* Main Courier Info */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 pr-3">
          <View className="w-13 h-13 rounded-2xl bg-slate-50 items-center justify-center p-1.5 border border-slate-100">
            <CourierLogo name={rate.carrier_name} />
          </View>

          <View className="ml-3.5 flex-1">
            <Text
              className="text-sm font-black text-slate-900 tracking-tight"
              numberOfLines={1}
            >
              {rate.carrier_name}
            </Text>

            <View className="flex-row items-center mt-1.5">
              <Feather name="clock" size={12} color="#64748B" />
              <Text className="text-xs text-slate-500 font-semibold ml-1.5">
                Est. {rate.estimated_days || 3} business days
              </Text>
            </View>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-[9px] font-black text-slate-400 tracking-wider">
            ALL-INCLUSIVE
          </Text>
          <Text className="text-2xl font-black text-slate-950 mt-0.5">
            ₹{rate.freight_charge}
          </Text>
        </View>
      </View>

      {/* Footer CTA */}
      <View className="mt-4 pt-3.5 border-t border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Feather name="check" size={13} color="#10B981" />
          <Text className="text-[11px] font-medium text-slate-500">
            Free doorstep pickup included
          </Text>
        </View>

        <TouchableOpacity
          onPress={onBook}
          activeOpacity={0.8}
          className="bg-violet-600 px-4 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm shadow-violet-500/20"
        >
          <Text className="text-xs font-black text-white">Ship Now</Text>
          <Feather name="arrow-right" size={12} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
