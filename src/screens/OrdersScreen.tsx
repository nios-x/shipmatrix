import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { Shipment } from '../types';

type Nav = NativeStackNavigationProp<OrdersStackParamList, 'Orders'>;

const STATUS_COLORS: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  'IN TRANSIT': 'bg-amber-100 text-amber-700',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  NDR: 'bg-red-100 text-red-700',
  RTO: 'bg-red-100 text-red-700',
  EXCEPTION: 'bg-orange-100 text-orange-700',
  'PICKUP DONE': 'bg-cyan-100 text-cyan-700',
  'PICKED UP': 'bg-cyan-100 text-cyan-700',
  DEFAULT: 'bg-gray-100 text-gray-600',
};

const FILTER_TABS = [
  'All',
  'Booked',
  'In Transit',
  'Delivered',
  'NDR',
  'RTO',
  'Cancelled',
];

function getStatusColor(status: string) {
  return STATUS_COLORS[status?.toUpperCase()] || STATUS_COLORS.DEFAULT;
}

const ACCENT_PURPLE = '#7C3AED';

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
      className={`px-3.5 py-2 rounded-xl border flex-row items-center gap-1.5 ${
        active ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          active ? 'text-white' : 'text-slate-600'
        }`}
      >
        {label}
      </Text>
      {typeof count === 'number' && (
        <View
          className={`px-1.5 py-0.5 rounded-full ${
            active ? 'bg-white/20' : 'bg-slate-100'
          }`}
        >
          <Text
            className={`text-[9px] font-black ${
              active ? 'text-white' : 'text-slate-600'
            }`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { shipments, loading } = useShipments();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: shipments.length,
    };
    FILTER_TABS.forEach((tab) => {
      if (tab === 'All') return;
      counts[tab] = shipments.filter((s) => {
        const status = (s.status || '').toUpperCase();
        const filter = tab.toUpperCase();
        if (filter === 'IN TRANSIT') {
          return ['IN TRANSIT', 'IN_TRANSIT', 'SHIPPED', 'PICKUP DONE', 'PICKED UP'].includes(status);
        }
        return status === filter;
      }).length;
    });
    return counts;
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    let filtered = shipments;

    // Filter by status tab
    if (activeFilter !== 'All') {
      filtered = filtered.filter((s) => {
        const status = (s.status || '').toUpperCase();
        const filter = activeFilter.toUpperCase();
        if (filter === 'IN TRANSIT') {
          return ['IN TRANSIT', 'IN_TRANSIT', 'SHIPPED', 'PICKUP DONE', 'PICKED UP'].includes(status);
        }
        return status === filter;
      });
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.awb?.toLowerCase().includes(q) ||
          s.orderId?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.courier?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [shipments, searchQuery, activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderItem = ({ item }: { item: Shipment }) => {
    const statusColor = getStatusColor(item.status || '');
    const [bgClass, textClass] = statusColor.split(' ');

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 shadow-xs"
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <CourierLogo name={item.courier || 'Unknown'} />
            <View>
              <Text className="font-black text-slate-900 text-sm">
                {item.courier || 'Unknown Courier'}
              </Text>
              <Text className="text-xs text-slate-400 font-medium mt-0.5">
                AWB: {item.awb || 'N/A'}
              </Text>
            </View>
          </View>
          <View className={`px-2.5 py-1 rounded-full ${bgClass}`}>
            <Text className={`text-[10px] font-black uppercase tracking-wider ${textClass}`}>
              {item.status || 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
          <View className="flex-1">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Customer
            </Text>
            <Text className="text-sm font-semibold text-slate-800 mt-0.5" numberOfLines={1}>
              {item.customerName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Product
            </Text>
            <Text className="text-sm font-semibold text-slate-800 mt-0.5" numberOfLines={1}>
              {item.productName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Payment
            </Text>
            <Text className="text-sm font-semibold text-slate-800 mt-0.5">
              {item.paymentType?.toUpperCase() || 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading orders..." />;

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-xl font-black text-slate-900 tracking-tight">
            Orders
          </Text>
          <Text className="text-xs text-slate-500 font-medium mt-0.5">
            {shipments.length > 0
              ? `${shipments.length} total orders tracked`
              : 'Manage and track your shipments'}
          </Text>
        </View>

        {/* Right Action Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateShipment', {})}
          activeOpacity={0.8}
          className="h-10 px-4 rounded-xl bg-violet-600 flex-row items-center gap-1.5 shadow-sm shadow-violet-500/20"
        >
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text className="text-xs font-black text-white">Ship</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-4 pt-3.5 mb-2.5">
        <View className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-xs flex-row items-center">
          <View className="w-8 h-8 rounded-xl bg-slate-50 items-center justify-center">
            <Feather name="search" size={15} color="#64748B" />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search orders, AWB, customer, courier..."
            placeholderTextColor="#94A3B8"
            className="flex-1 ml-2 text-xs font-semibold text-slate-800 py-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x-circle" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="mb-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          data={FILTER_TABS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <FilterTab
              label={item}
              count={tabCounts[item]}
              active={activeFilter === item}
              onPress={() => setActiveFilter(item)}
            />
          )}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredShipments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: Math.max(insets.bottom + 32, 48),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[ACCENT_PURPLE]}
            tintColor={ACCENT_PURPLE}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No orders yet"
            subtitle="Create your first shipment to get started."
            actionLabel="Create Shipment"
            onAction={() => navigation.navigate('CreateShipment', {})}
          />
        }
      />
    </View>
  );
}
