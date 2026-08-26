import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';

export default function WeightDiscrepancyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments } = useShipments();
  const discrepancies = shipments.filter((s) => (s as any).weightDiscrepancy);

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Weight Discrepancy</Text>
      </View>
      <FlatList
        data={discrepancies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <Text className="font-bold text-gray-900">{item.courier}</Text>
            <Text className="text-xs text-gray-500">AWB: {item.awb}</Text>
            <TouchableOpacity className="bg-orange-100 py-2 rounded-lg items-center mt-3">
              <Text className="text-xs font-bold text-orange-700">Raise Dispute</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No discrepancies" subtitle="No weight disputes found." />}
      />
    </View>
  );
}
