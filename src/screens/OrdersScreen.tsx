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

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { shipments, loading } = useShipments();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

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
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100/90"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <CourierLogo name={item.courier || 'Unknown'} />
            <View>
              <Text className="font-geist-bold text-gray-900 text-sm">
                {item.courier || 'Unknown Courier'}
              </Text>
              <Text className="text-xs text-gray-400 font-geist-medium mt-0.5">
                AWB: {item.awb || 'N/A'}
              </Text>
            </View>
          </View>
          <View className={`px-2.5 py-1 rounded-full ${bgClass}`}>
            <Text className={`text-[10px] font-geist-bold uppercase tracking-wider ${textClass}`}>
              {item.status || 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between pt-3 border-t border-gray-100/60">
          <View className="flex-1">
            <Text className="text-[10px] text-gray-400 font-geist-bold uppercase tracking-wider">
              Customer
            </Text>
            <Text className="text-sm font-geist-semibold text-gray-800 mt-0.5" numberOfLines={1}>
              {item.customerName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-gray-400 font-geist-bold uppercase tracking-wider">
              Product
            </Text>
            <Text className="text-sm font-geist-semibold text-gray-800 mt-0.5" numberOfLines={1}>
              {item.productName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="text-[10px] text-gray-400 font-geist-bold uppercase tracking-wider">
              Payment
            </Text>
            <Text className="text-sm font-geist-semibold text-gray-800 mt-0.5">
              {item.paymentType?.toUpperCase() || 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading orders..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <Text className="text-2xl font-geist-bold text-gray-900 tracking-tight">Orders</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateShipment', {})}
          activeOpacity={0.8}
          className="bg-purple-900 px-4 py-2.5 rounded-xl flex-row items-center gap-2 shadow-md shadow-purple-900/20"
          style={{ elevation: 3 }}
        >
          <Feather name="plus" size={16} color="white" />
          <Text className="text-white font-geist-bold text-sm">Ship</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="px-5 mb-3">
        <View className="relative">
          <View className="absolute left-3.5 top-3 z-10">
            <Feather name="search" size={18} color="#9ca3af" />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search orders, AWB, customer..."
            placeholderTextColor="#9ca3af"
            className="bg-white border border-gray-200/80 rounded-xl pl-10 pr-4 py-2.5 text-sm font-geist-medium text-gray-900 shadow-sm"
          />
        </View>
      </View>

      {/* Filter tabs */}
      <View className="mb-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          data={FILTER_TABS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveFilter(item)}
              activeOpacity={0.8}
              className={`px-4 py-2 rounded-full ${activeFilter === item
                ? 'bg-purple-900 shadow-sm shadow-purple-900/20'
                : 'bg-white border border-gray-200/80'
                }`}
            >
              <Text
                className={`text-xs font-geist-bold ${activeFilter === item ? 'text-white' : 'text-gray-600'
                  }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredShipments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
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
