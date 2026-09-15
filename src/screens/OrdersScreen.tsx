import React, { useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatCurrency } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import {
  isCod,
  codValue,
  normalizeStatus,
  statusPillClasses,
  isBooked,
  isInTransit,
  isDelivered,
  isNdr,
  isRto,
  isCancelled,
  isActive,
  isCancellable,
  refundableAmount,
} from '../lib/shipments';
import { cancelOrder, CancelError } from '../lib/cancelOrder';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { toast } from '../lib/alert';
import { api } from '../lib/api';
import type { Shipment } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Nav = NativeStackNavigationProp<OrdersStackParamList, 'Orders'>;

const FILTER_TABS = ['All', 'Booked', 'In Transit', 'Delivered', 'NDR', 'RTO', 'Cancelled'];

/**
 * Tabs group the courier status vocabulary rather than matching it literally —
 * 'Booked' covers 'Ready to Pickup'/'Pending', 'In Transit' covers 'Picked Up'
 * and 'Out for Delivery', and so on.
 */
function matchesTab(shipment: Shipment, tab: string): boolean {
  switch (tab) {
    case 'Booked':
      return isBooked(shipment);
    case 'In Transit':
      return isInTransit(shipment);
    case 'Delivered':
      return isDelivered(shipment);
    case 'NDR':
      return isNdr(shipment);
    case 'RTO':
      return isRto(shipment);
    case 'Cancelled':
      return isCancelled(shipment);
    default:
      return normalizeStatus(shipment) === tab.toUpperCase();
  }
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
      className={`flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2 ${
        active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
      }`}>
      <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </Text>
      {typeof count === 'number' && (
        <View className={`rounded-full px-1.5 py-0.5 ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
          <Text className={`font-black text-[9px] ${active ? 'text-white' : 'text-slate-600'}`}>
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
      counts[tab] = shipments.filter((s) => matchesTab(s, tab)).length;
    });
    return counts;
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    let filtered = shipments;

    // Filter by status tab
    if (activeFilter !== 'All') {
      filtered = filtered.filter((s) => matchesTab(s, activeFilter));
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

  /**
   * Pulls fresh tracking for every in-flight shipment. The Firestore listener
   * pushes the updated rows back automatically, so nothing is set locally here.
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const active = shipments.filter((s) => s.awb && isActive(s));
      // Bounded concurrency — a large account would otherwise fire hundreds of
      // requests at once and get rate-limited.
      const BATCH = 5;
      for (let i = 0; i < active.length; i += BATCH) {
        await Promise.all(
          active
            .slice(i, i + BATCH)
            .map((s) =>
              api.post(`/api/v1/shipments/sync/${s.awb}`, { courier: s.courier }).catch(() => null)
            )
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * The order the cancel sheet is open for, held as an id and resolved against
   * the live list on every render.
   *
   * Storing the shipment itself would freeze it at the moment the sheet opened,
   * so a status or refund amount that changed underneath — the sync on pull-to-
   * refresh, or a cancellation from another device — would keep showing the
   * stale value. Resolving by id also closes the sheet on its own if the order
   * stops existing. One modal serves the whole list, so this is a screen-level
   * value rather than per-row state.
   */
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const cancelTarget = cancelTargetId
    ? (shipments.find((s) => s.id === cancelTargetId) ?? null)
    : null;

  /**
   * Cancelling releases the AWB at the courier first; the record and the wallet
   * are only touched if it agrees. A refusal therefore changes nothing, so the
   * sheet stays open to retry rather than closing on a failure.
   */
  const handleCancel = async (reason: string) => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      const refunded = await cancelOrder(cancelTarget, reason);
      setCancelTargetId(null);
      toast.success(
        'Order Cancelled',
        refunded > 0
          ? `${formatCurrency(refunded)} has been refunded to your wallet.`
          : 'The courier has released this AWB.'
      );
    } catch (e: any) {
      toast.error(
        'Could not cancel',
        e instanceof CancelError ? e.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const renderItem = ({ item }: { item: Shipment }) => {
    const [bgClass, textClass] = statusPillClasses(item);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('OrderDetails', { shipmentId: item.id })}
        className="shadow-xs mb-3 rounded-2xl border border-slate-100 bg-white p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <CourierLogo name={item.courier || 'Unknown'} />
            <View>
              <Text className="font-black text-sm text-slate-900">
                {item.courier || 'Unknown Courier'}
              </Text>
              <Text className="mt-0.5 font-medium text-xs text-slate-400">
                AWB: {item.awb || 'N/A'}
              </Text>
            </View>
          </View>
          <View className={`rounded-full px-2.5 py-1 ${bgClass}`}>
            <Text className={`font-black text-[10px] uppercase tracking-wider ${textClass}`}>
              {item.status || 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
          <View className="flex-1">
            <Text className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
              Customer
            </Text>
            <Text className="mt-0.5 font-semibold text-sm text-slate-800" numberOfLines={1}>
              {item.customerName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
              Product
            </Text>
            <Text className="mt-0.5 font-semibold text-sm text-slate-800" numberOfLines={1}>
              {item.productName || 'N/A'}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
              Payment
            </Text>
            <Text className="mt-0.5 font-semibold text-sm text-slate-800">
              {isCod(item) ? `COD ${formatCurrency(codValue(item))}` : 'PREPAID'}
            </Text>
          </View>
        </View>

        {/* Only orders the courier can still release show this. A delivered,
            RTO or already-cancelled order has nothing to cancel, and one
            without an AWB was never handed to a courier. */}
        {isCancellable(item) && (
          <TouchableOpacity
            onPress={() => setCancelTargetId(item.id)}
            activeOpacity={0.8}
            className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50">
            <Feather name="x-circle" size={14} color="#E11D48" />
            <Text className="font-raleway-bold text-xs text-rose-600">Cancel Order</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading orders..." />;

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1">
          <Text className="font-black text-xl tracking-tight text-slate-900">Orders</Text>
          <Text className="mt-0.5 font-medium text-xs text-slate-500">
            {shipments.length > 0
              ? `${shipments.length} total orders tracked`
              : 'Manage and track your shipments'}
          </Text>
        </View>

        {/* Right Action Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateShipment', {})}
          activeOpacity={0.8}
          className="h-10 flex-row items-center gap-1.5 rounded-xl bg-violet-600 px-4 shadow-sm shadow-violet-500/20">
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text className="font-black text-xs text-white">Ship</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="mb-2.5 px-4 pt-3.5">
        <View className="shadow-xs flex-row items-center rounded-2xl border border-slate-100 bg-white p-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-50">
            <Feather name="search" size={15} color="#64748B" />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search orders, AWB, customer, courier..."
            placeholderTextColor="#94A3B8"
            className="ml-2 flex-1 py-0 font-semibold text-xs text-slate-800"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
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

      {cancelTarget && (
        <CancelOrderModal
          awb={cancelTarget.awb}
          refund={refundableAmount(cancelTarget)}
          submitting={cancelling}
          onClose={() => setCancelTargetId(null)}
          onConfirm={handleCancel}
        />
      )}
    </View>
  );
}
