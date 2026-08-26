import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';

export default function CourierPerformanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments } = useShipments();

  const couriers = ['Delhivery', 'Xpressbees', 'Ekart', 'Shadowfax', 'BlueDart', 'Shree Maruti', 'Amazon'];
  const stats = couriers.map((c) => {
    const courierShipments = shipments.filter((s) => s.courier?.toLowerCase().includes(c.toLowerCase()));
    const delivered = courierShipments.filter((s) => s.status?.toUpperCase() === 'DELIVERED').length;
    return { name: c, total: courierShipments.length, delivered, rate: courierShipments.length > 0 ? ((delivered / courierShipments.length) * 100).toFixed(0) : '0' };
  }).filter((s) => s.total > 0);

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Courier Performance</Text>
      </View>
      <ScrollView className="flex-1 px-5">
        {stats.length === 0 ? (
          <View className="items-center py-20"><Feather name="bar-chart-2" size={48} color="#d1d5db" /><Text className="text-gray-400 font-medium mt-4">No data yet. Ship more to see stats!</Text></View>
        ) : stats.map((s) => (
          <View key={s.name} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-bold text-gray-900">{s.name}</Text>
              <Text className="text-xs font-bold text-purple-600">{s.rate}% delivery rate</Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View className="h-full bg-violet-700 rounded-full" style={{ width: `${s.rate}%` as any }} />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-gray-400">Total: {s.total}</Text>
              <Text className="text-xs text-gray-400">Delivered: {s.delivered}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
