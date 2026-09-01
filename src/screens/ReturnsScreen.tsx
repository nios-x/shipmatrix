import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import { resolveLabelUrl, LabelError } from '../lib/labels';
import { isRto, isDelivered, normalizeStatus, formatDate, destinationLabel } from '../lib/shipments';
import type { Shipment } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Tab = 'all' | 'rto' | 'reverse';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rto', label: 'RTO' },
  { key: 'reverse', label: 'Reverse Pickups' },
];

export default function ReturnsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { shipments, loading } = useShipments();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // A return is either a courier-initiated RTO or a reverse pickup we booked.
  const { rto, reverse, all } = useMemo(() => {
    const rtoList = shipments.filter((s) => isRto(s) && !s.isReverse);
    const reverseList = shipments.filter((s) => s.isReverse);
    return { rto: rtoList, reverse: reverseList, all: [...reverseList, ...rtoList] };
  }, [shipments]);

  const rows = activeTab === 'rto' ? rto : activeTab === 'reverse' ? reverse : all;

  const openLabel = async (item: Shipment) => {
    try {
      const url = await resolveLabelUrl(item);
      await Linking.openURL(url);
    } catch (e: any) {
      if (e instanceof LabelError) {
        toast.warning('No Label', e.message);
      } else {
        toast.error('Error', 'Could not open the label.');
      }
    }
  };

  const renderItem = ({ item }: { item: Shipment }) => {
    const delivered = isDelivered(item);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => item.awb && navigation.navigate('HomeTab', {
          screen: 'Tracking',
          params: { awb: item.awb },
        })}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
        style={{ elevation: 1 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <CourierLogo name={item.courierName || item.courier || ''} />
            <View className="flex-1">
              <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
                {item.courierName || item.courier || 'Courier'}
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">AWB: {item.awb || 'Pending'}</Text>
            </View>
          </View>

          <View
            className={`px-2.5 py-1 rounded-lg ${
              delivered ? 'bg-emerald-100' : item.isReverse ? 'bg-violet-100' : 'bg-red-100'
            }`}
          >
            <Text
              className={`text-[10px] font-bold uppercase ${
                delivered ? 'text-emerald-700' : item.isReverse ? 'text-violet-700' : 'text-red-700'
              }`}
            >
              {normalizeStatus(item) || 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[11px] text-gray-500" numberOfLines={1}>
              {item.isReverse ? 'From' : 'To'}: {destinationLabel(item)}
            </Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">
              {item.isReverse ? 'Reverse pickup' : 'Return to origin'} · {formatDate(item.createdAt)}
            </Text>
          </View>

          {!!item.awb && (
            <TouchableOpacity
              onPress={() => openLabel(item)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg"
            >
              <Feather name="download" size={12} color="#4b5563" />
              <Text className="text-[11px] font-bold text-gray-700">Label</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading returns..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900 flex-1">Returns</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('OrdersTab', { screen: 'CreateReverseShipment', initial: false, params: {} })
          }
          activeOpacity={0.8}
          className="bg-violet-700 px-4 py-2 rounded-xl flex-row items-center gap-1"
        >
          <Feather name="plus" size={14} color="white" />
          <Text className="text-white font-bold text-xs">New Return</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="px-5 mb-3 flex-row gap-2">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count =
            tab.key === 'rto' ? rto.length : tab.key === 'reverse' ? reverse.length : all.length;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl border ${
                active ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
              }`}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                {tab.label}
              </Text>
              <View className={`px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                <Text className={`text-[9px] font-black ${active ? 'text-white' : 'text-slate-600'}`}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            title="No returns"
            subtitle={
              activeTab === 'reverse'
                ? 'Reverse pickups you book will appear here.'
                : 'Undelivered shipments returned to origin will appear here.'
            }
          />
        }
      />
    </View>
  );
}
