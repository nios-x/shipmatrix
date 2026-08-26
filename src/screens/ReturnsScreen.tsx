import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { Shipment } from '../types';

export default function ReturnsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { shipments, loading } = useShipments();

  const returns = shipments.filter((s) => {
    const st = (s.status || '').toUpperCase();
    return ['RTO', 'RTO IN TRANSIT', 'RTO_INITIATED', 'RETURN', 'RETURNED'].includes(st);
  });

  if (loading) return <LoadingSpinner fullScreen message="Loading returns..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900 flex-1">Returns</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateReverseShipment', {})}
          className="bg-violet-700 px-4 py-2 rounded-xl flex-row items-center gap-1"
        >
          <Feather name="plus" size={14} color="white" />
          <Text className="text-white font-bold text-xs">New Return</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={returns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <CourierLogo name={item.courier || ''} />
                <View>
                  <Text className="font-bold text-gray-900 text-sm">{item.courier}</Text>
                  <Text className="text-xs text-gray-400">AWB: {item.awb}</Text>
                </View>
              </View>
              <View className="bg-red-100 px-2.5 py-1 rounded-lg">
                <Text className="text-[10px] font-bold text-red-700 uppercase">{item.status}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No returns" subtitle="No RTO/return shipments found." />}
      />
    </View>
  );
}
