import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api, routes } from '../lib/api';
import { useShipments } from '../lib/useShipments';
import { formatDateTime } from '../lib/shipments';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

interface TrackEvent {
  status: string;
  location?: string;
  timestamp?: string;
  description?: string;
}

interface ShipmentInfo {
  awb: string;
  courier?: string;
  status?: string;
}

/**
 * `/api/public/track/:awb` answers with a flat body — `{ success, status,
 * courier, scans }` — with the checkpoints under `scans`, newest first. There
 * is no `tracking` envelope. Couriers disagree on what to call a checkpoint's
 * time and its note, so both spellings of each are read here, as the web app does.
 */
function toEvents(scans: any): TrackEvent[] {
  if (!Array.isArray(scans)) return [];
  return scans.map((scan: any) => ({
    status: scan.status || 'Update',
    location: scan.location || undefined,
    timestamp: scan.time || scan.timestamp || undefined,
    description: scan.message || scan.remarks || undefined,
  }));
}

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { shipments } = useShipments();
  const [awb, setAwb] = useState(route.params?.awb || '');
  const [tracking, setTracking] = useState(false);
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [shipmentInfo, setShipmentInfo] = useState<ShipmentInfo | null>(null);
  const [error, setError] = useState('');

  const handleTrack = useCallback(
    async (value?: string) => {
      const typed = (value ?? awb).trim();
      if (!typed) return;

      // The field takes either identifier, but the endpoint only resolves
      // carrier waybills — an order reference (ORD-313654) comes back as
      // "Shipment not found on any network". Map it to its AWB first.
      const order = shipments.find(
        (s) => s.orderId && s.orderId.trim().toLowerCase() === typed.toLowerCase()
      );
      if (order && !order.awb) {
        setEvents([]);
        setShipmentInfo(null);
        setError('This order has no AWB yet. Tracking begins once the courier assigns one.');
        return;
      }
      const target = order?.awb || typed;

      setTracking(true);
      setError('');
      setEvents([]);
      setShipmentInfo(null);
      try {
        const data = await api.get(routes.publicTrack(target));
        if (data.success) {
          setEvents(toEvents(data.scans));
          setShipmentInfo({
            awb: target,
            courier: data.courier || order?.courier,
            status: data.status,
          });
        } else {
          // A miss answers 200 with `message`, not `error`. Keep the server's
          // wording — it separates an unknown AWB from a silent courier.
          setError(data.message || data.error || 'No tracking info found');
        }
      } catch (err: any) {
        setError(err.message || 'Tracking failed');
      } finally {
        setTracking(false);
      }
    },
    [awb, shipments]
  );

  // Track straight away when opened from an order row, so the user doesn't
  // have to tap search on an AWB that was already chosen for them. `awb` is
  // already seeded from the param, so only the fetch needs triggering here.
  const initialAwb = route.params?.awb;
  useEffect(() => {
    if (initialAwb) handleTrack(initialAwb);
    // Keyed on the param alone — depending on `handleTrack` would re-fetch on
    // every keystroke, since it closes over the editable `awb` field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAwb]);

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-xl bg-white border border-gray-100 items-center justify-center shadow-xs">
          <Feather name="arrow-left" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-raleway-bold text-gray-900 tracking-tight">Track Shipment</Text>
      </View>

      <View className="px-5 mb-4">
        <View className="flex-row gap-3">
          <TextInput
            value={awb}
            onChangeText={setAwb}
            placeholder="Enter AWB or Order ID"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 bg-white border border-gray-200/80 rounded-xl px-4 py-3 text-sm font-raleway text-gray-900 shadow-sm"
            onSubmitEditing={() => handleTrack()}
          />
          <TouchableOpacity onPress={() => handleTrack()} disabled={tracking} activeOpacity={0.8} className="bg-violet-700 px-5 rounded-xl items-center justify-center shadow-md shadow-purple-900/20" style={{ elevation: 3 }}>
            <Feather name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {tracking && <LoadingSpinner message="Tracking shipment..." />}
      {error ? (
        <View className="mx-5 bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-4">
          <Text className="text-rose-600 text-sm font-raleway text-center">{error}</Text>
        </View>
      ) : null}

      {shipmentInfo && (
        <View className="mx-5 bg-white rounded-2xl p-4 border border-gray-100/90 mb-4 shadow-sm" style={{ elevation: 2 }}>
          <Text className="font-raleway-bold text-gray-900 text-base">{shipmentInfo.courier || 'Courier'}</Text>
          <Text className="text-xs font-raleway text-gray-400 mt-0.5" selectable>AWB: {shipmentInfo.awb}</Text>
          {shipmentInfo.status && (
            <View className="bg-purple-50 border border-purple-100 px-3 py-1 rounded-full mt-2.5 self-start">
              <Text className="text-xs font-raleway-bold text-purple-700 uppercase tracking-wider">{shipmentInfo.status}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }} className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {shipmentInfo && events.length === 0 && !tracking ? (
          <Text className="text-sm font-raleway text-gray-400 italic py-2">No tracking history available yet.</Text>
        ) : null}
        {events.map((event, index) => (
          <View key={index} className="flex-row mb-1">
            <View className="items-center mr-4 w-6">
              <View className={`w-3.5 h-3.5 rounded-full ${index === 0 ? 'bg-violet-700 shadow-sm shadow-purple-900/40' : 'bg-gray-300'}`} />
              {index < events.length - 1 && <View className="w-0.5 flex-1 bg-gray-200 mt-1" />}
            </View>
            <View className="flex-1 pb-6">
              <Text className="font-raleway-bold text-gray-900 text-sm">{event.status}</Text>
              {event.location && <Text className="text-xs font-raleway text-gray-500 mt-0.5">{event.location}</Text>}
              {event.timestamp && <Text className="text-xs font-raleway text-gray-400 mt-0.5">{formatDateTime(event.timestamp, event.timestamp)}</Text>}
              {event.description && <Text className="text-xs font-raleway text-gray-400 mt-0.5">{event.description}</Text>}
            </View>
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
