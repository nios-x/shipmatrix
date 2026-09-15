import React, { useState, useMemo, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { api, routes } from '../lib/api';
import { RateCard, RateCardSkeleton, isAirService } from '../components/RateCard';
import { toast } from '../lib/alert';
import { parseRates, type RateResult } from '../lib/rates';
import { formatDimensions, formatRate, formatWeight } from '../lib/format';
import { weightBreakdown } from '../lib/weight';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export type { RateResult };

const ACCENT_PURPLE = '#7C3AED';

type Filter = 'all' | 'cheapest' | 'fastest' | 'air' | 'surface';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'air', label: 'Air Express' },
  { id: 'surface', label: 'Surface' },
];

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
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const fetchRates = async (isRefresh = false) => {
    if (!pickupPin || !deliveryPin || !weight) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await api.post(routes.rates, {
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
        const parsedRates: RateResult[] = parseRates(data.data);
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

  // Quotes normally arrive with the navigation; only a deep link or a restored
  // screen has to fetch its own. Started on the next tick so the loading state
  // it sets does not render twice before paint.
  useEffect(() => {
    if (initialRates.length > 0) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) void fetchRates();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Runs once for the params this screen opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The same chargeable weight the server priced these quotes on.
  const parcel = weightBreakdown(weight, length, width, height);
  const dimensions = formatDimensions(length, width, height);

  const filteredRates = useMemo(() => {
    let list = [...rates];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.carrier_name.toLowerCase().includes(q));
    }

    if (activeFilter === 'air') {
      list = list.filter(isAirService);
    } else if (activeFilter === 'surface') {
      list = list.filter((r) => !isAirService(r));
    }

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
      initial: false,
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

  const showList = !loading && filteredRates.length > 0;
  const showEmpty = !loading && filteredRates.length === 0;

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text variant="title">Available Couriers</Text>
            <Text variant="meta" className="mt-0.5">
              {loading
                ? 'Finding the best shipping partner…'
                : `${rates.length} courier ${rates.length === 1 ? 'option' : 'options'} for your shipment`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => fetchRates(true)}
          disabled={refreshing || loading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh rates"
          className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Feather name="rotate-cw" size={16} color="#334155" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
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
        }>
        {/* Shipment summary: the route and the parcel these quotes are for. */}
        <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white">
          <View className="flex-row items-center px-4 pb-3 pt-3.5">
            <View className="flex-1">
              <Text variant="label">Pickup</Text>
              <Text variant="value" className="mt-0.5 text-base">
                {pickupPin || '—'}
              </Text>
            </View>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <Feather name="arrow-right" size={14} color="#475569" />
            </View>
            <View className="flex-1 items-end">
              <Text variant="label">Delivery</Text>
              <Text variant="value" className="mt-0.5 text-base">
                {deliveryPin || '—'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <View className="mr-3 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <Text variant="meta" className="text-slate-700">
                {formatWeight(parcel.chargeable)}{' '}
                <Text className="text-slate-500">
                  {parcel.basis === 'volumetric' ? 'volumetric' : 'chargeable'}
                </Text>
              </Text>
              {dimensions && (
                <Text variant="meta" className="text-slate-700">
                  {dimensions}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="flex-row items-center gap-1">
              <Feather name="edit-2" size={12} color="#6D28D9" />
              <Text className="font-semibold text-[13px] text-violet-700">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary strip */}
        {rates.length > 0 && !loading && (
          <View className="mb-4 flex-row rounded-2xl border border-slate-200/80 bg-white py-3">
            <Stat label="From" value={formatRate(cheapestRate)} />
            <View className="w-px bg-slate-100" />
            <Stat label="Fastest" value={`${fastestDays} ${fastestDays === 1 ? 'day' : 'days'}`} />
            <View className="w-px bg-slate-100" />
            <Stat label="Couriers" value={String(rates.length)} />
          </View>
        )}

        {/* Search */}
        {rates.length > 0 && (
          <View className="mb-3 h-11 flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
            <Feather name="search" size={16} color="#64748B" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search couriers"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
              className="ml-2 min-w-0 flex-1 py-0 text-sm text-slate-900"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filters */}
        {rates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-4 mb-4"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                label={f.label}
                count={f.id === 'all' ? rates.length : undefined}
                active={activeFilter === f.id}
                onPress={() => setActiveFilter(f.id)}
              />
            ))}
          </ScrollView>
        )}

        {loading && <RateCardSkeleton />}

        {showList &&
          filteredRates.map((rate) => (
            <RateCard
              key={rate.carrier_id}
              rate={rate}
              isCheapest={rate.freight_charge === cheapestRate}
              isFastest={rate.estimated_days === fastestDays}
              onPress={() => handleBookCourier(rate)}
            />
          ))}

        {showEmpty && (
          <View className="my-2 items-center rounded-2xl border border-slate-200/80 bg-white px-6 py-8">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Feather name={searchQuery ? 'search' : 'package'} size={22} color="#475569" />
            </View>
            <Text variant="heading" className="text-center">
              No couriers found
            </Text>
            <Text variant="body" className="mb-5 mt-1 max-w-[280px] text-center text-slate-500">
              {searchQuery
                ? `Nothing matches “${searchQuery}”. Try a different name or clear the search.`
                : 'No courier partner serves this route with the selected filter.'}
            </Text>
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                activeOpacity={0.85}
                className="h-10 justify-center rounded-xl border border-slate-200 bg-white px-4">
                <Text variant="button" className="text-slate-800">
                  Clear search
                </Text>
              </TouchableOpacity>
            ) : activeFilter !== 'all' ? (
              <TouchableOpacity
                onPress={() => setActiveFilter('all')}
                activeOpacity={0.85}
                className="h-10 justify-center rounded-xl border border-slate-200 bg-white px-4">
                <Text variant="button" className="text-slate-800">
                  Show all couriers
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
                className="h-10 justify-center rounded-xl bg-violet-600 px-4">
                <Text variant="button" className="text-white">
                  Change pincodes
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Service promises */}
        {showList && (
          <View className="mt-2 flex-row items-center justify-center gap-5 px-2">
            <ServicePromise icon="shield" label="Insured goods" />
            <ServicePromise icon="truck" label="Doorstep pickup" />
            <ServicePromise icon="activity" label="Live tracking" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────
   SUBCOMPONENTS
───────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center px-2">
      <Text variant="label">{label}</Text>
      <Text variant="value" className="mt-0.5" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ServicePromise({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Feather name={icon} size={12} color="#64748B" />
      <Text variant="meta">{label}</Text>
    </View>
  );
}

function FilterChip({
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
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 ${
        active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
      }`}>
      <Text className={`font-semibold text-[13px] ${active ? 'text-white' : 'text-slate-700'}`}>
        {label}
      </Text>
      {typeof count === 'number' && (
        <Text
          className={`font-semibold text-[12px] ${active ? 'text-white/70' : 'text-slate-500'}`}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}
