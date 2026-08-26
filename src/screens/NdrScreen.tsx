import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';

export default function NdrScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments, loading } = useShipments();

  const ndrShipments = shipments.filter((s) => {
    const st = (s.status || '').toUpperCase();
    return ['NDR', 'UNDELIVERED', 'EXCEPTION'].includes(st);
  });

  if (loading) return <LoadingSpinner fullScreen message="Loading NDR..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">NDR Management</Text>
      </View>
      <FlatList
        data={ndrShipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-bold text-gray-900">{item.courier}</Text>
              <View className="bg-red-100 px-2.5 py-1 rounded-lg">
                <Text className="text-[10px] font-bold text-red-700 uppercase">{item.status}</Text>
              </View>
            </View>
            <Text className="text-xs text-gray-500">AWB: {item.awb}</Text>
            <Text className="text-xs text-gray-500">Customer: {item.customerName}</Text>
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity className="flex-1 bg-green-100 py-2 rounded-lg items-center">
                <Text className="text-xs font-bold text-green-700">Re-attempt</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-red-100 py-2 rounded-lg items-center">
                <Text className="text-xs font-bold text-red-700">RTO</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No NDR" subtitle="No undelivered shipments found." />}
      />
    </View>
  );
}
