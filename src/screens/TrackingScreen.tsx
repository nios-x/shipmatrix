import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface TrackEvent {
  status: string;
  location?: string;
  timestamp?: string;
  description?: string;
}

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [awb, setAwb] = useState(route.params?.awb || '');
  const [tracking, setTracking] = useState(false);
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [shipmentInfo, setShipmentInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const handleTrack = async () => {
    if (!awb.trim()) return;
    setTracking(true);
    setError('');
    setEvents([]);
    try {
      const data = await api.get(`/api/public/track/${awb.trim()}`);
      if (data.success && data.tracking) {
        setEvents(data.tracking.events || []);
        setShipmentInfo(data.tracking);
      } else {
        setError(data.error || 'No tracking info found');
      }
    } catch (err: any) {
      setError(err.message || 'Tracking failed');
    } finally {
      setTracking(false);
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Track Shipment</Text>
      </View>

      <View className="px-5 mb-4">
        <View className="flex-row gap-3">
          <TextInput
            value={awb}
            onChangeText={setAwb}
            placeholder="Enter AWB number"
            placeholderTextColor="#9ca3af"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900"
            onSubmitEditing={handleTrack}
          />
          <TouchableOpacity onPress={handleTrack} disabled={tracking} activeOpacity={0.8} className="bg-purple-900 px-5 rounded-xl items-center justify-center" style={{ elevation: 4 }}>
            <Feather name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {tracking && <LoadingSpinner message="Tracking..." />}
      {error ? (
        <View className="mx-5 bg-red-50 p-4 rounded-xl">
          <Text className="text-red-600 text-sm font-medium text-center">{error}</Text>
        </View>
      ) : null}

      {shipmentInfo && (
        <View className="mx-5 bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
          <Text className="font-bold text-gray-900">{shipmentInfo.courier || 'Courier'}</Text>
          <Text className="text-xs text-gray-400 mt-1">AWB: {awb}</Text>
          {shipmentInfo.current_status && (
            <View className="bg-purple-100 px-3 py-1 rounded-lg mt-2 self-start">
              <Text className="text-xs font-bold text-purple-700">{shipmentInfo.current_status}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {events.map((event, index) => (
          <View key={index} className="flex-row mb-1">
            <View className="items-center mr-4 w-6">
              <View className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-purple-900' : 'bg-gray-300'}`} />
              {index < events.length - 1 && <View className="w-0.5 flex-1 bg-gray-200 mt-1" />}
            </View>
            <View className="flex-1 pb-6">
              <Text className="font-semibold text-gray-900 text-sm">{event.status}</Text>
              {event.location && <Text className="text-xs text-gray-500 mt-0.5">{event.location}</Text>}
              {event.timestamp && <Text className="text-xs text-gray-400 mt-0.5">{event.timestamp}</Text>}
              {event.description && <Text className="text-xs text-gray-400 mt-0.5">{event.description}</Text>}
            </View>
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
