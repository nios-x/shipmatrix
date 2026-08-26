import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';

export default function CodRemittanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments } = useShipments();
  const codShipments = shipments.filter((s) => s.paymentType === 'cod' && s.status?.toUpperCase() === 'DELIVERED');

  const totalCod = codShipments.reduce((sum, s) => sum + (s.codAmount || 0), 0);

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">COD Remittance</Text>
      </View>

      <View className="mx-5 mb-4 bg-white rounded-2xl p-5 border border-gray-100" style={{ elevation: 2 }}>
        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total COD Collected</Text>
        <Text className="text-3xl font-black text-gray-900">₹{totalCod.toFixed(2)}</Text>
        <Text className="text-xs text-gray-400 mt-1">{codShipments.length} delivered COD orders</Text>
      </View>

      <FlatList
        data={codShipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-bold text-gray-900 text-sm">{item.customerName}</Text>
                <Text className="text-xs text-gray-400">AWB: {item.awb}</Text>
              </View>
              <Text className="font-black text-green-600">₹{(item.codAmount || 0).toFixed(0)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No COD orders" subtitle="Delivered COD orders will appear here." />}
      />
    </View>
  );
}
