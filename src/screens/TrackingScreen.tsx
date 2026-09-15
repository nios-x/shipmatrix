import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
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
    if (!initialAwb) return;
    // Started on the next tick so the tracking state it sets does not render
    // twice before the screen first paints.
    let active = true;
    const timer = setTimeout(() => {
      if (active) handleTrack(initialAwb);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Keyed on the param alone — depending on `handleTrack` would re-fetch on
    // every keystroke, since it closes over the editable `awb` field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAwb]);

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 py-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="shadow-xs h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white">
          <Feather name="arrow-left" size={20} color="#1f2937" />
        </TouchableOpacity>
        <Text className="font-raleway-bold text-xl tracking-tight text-gray-900">
          Track Shipment
        </Text>
      </View>

      <View className="mb-4 px-5">
        <View className="flex-row gap-3">
          <TextInput
            value={awb}
            onChangeText={setAwb}
            placeholder="Enter AWB or Order ID"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 rounded-xl border border-gray-200/80 bg-white px-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
            onSubmitEditing={() => handleTrack()}
          />
          <TouchableOpacity
            onPress={() => handleTrack()}
            disabled={tracking}
            activeOpacity={0.8}
            className="items-center justify-center rounded-xl bg-violet-700 px-5 shadow-md shadow-purple-900/20"
            style={{ elevation: 3 }}>
            <Feather name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {tracking && <LoadingSpinner message="Tracking shipment..." />}
      {error ? (
        <View className="mx-5 mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <Text className="text-center font-raleway text-sm text-rose-600">{error}</Text>
        </View>
      ) : null}

      {shipmentInfo && (
        <View
          className="mx-5 mb-4 rounded-2xl border border-gray-100/90 bg-white p-4 shadow-sm"
          style={{ elevation: 2 }}>
          <Text className="font-raleway-bold text-base text-gray-900">
            {shipmentInfo.courier || 'Courier'}
          </Text>
          <Text className="mt-0.5 font-raleway text-xs text-gray-400" selectable>
            AWB: {shipmentInfo.awb}
          </Text>
          {shipmentInfo.status && (
            <View className="mt-2.5 self-start rounded-full border border-purple-100 bg-purple-50 px-3 py-1">
              <Text className="font-raleway-bold text-xs uppercase tracking-wider text-purple-700">
                {shipmentInfo.status}
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}>
        {shipmentInfo && events.length === 0 && !tracking ? (
          <Text className="py-2 font-raleway text-sm italic text-gray-400">
            No tracking history available yet.
          </Text>
        ) : null}
        {events.map((event, index) => (
          <View key={index} className="mb-1 flex-row">
            <View className="mr-4 w-6 items-center">
              <View
                className={`h-3.5 w-3.5 rounded-full ${index === 0 ? 'bg-violet-700 shadow-sm shadow-purple-900/40' : 'bg-gray-300'}`}
              />
              {index < events.length - 1 && <View className="mt-1 w-0.5 flex-1 bg-gray-200" />}
            </View>
            <View className="flex-1 pb-6">
              <Text className="font-raleway-bold text-sm text-gray-900">{event.status}</Text>
              {event.location && (
                <Text className="mt-0.5 font-raleway text-xs text-gray-500">{event.location}</Text>
              )}
              {event.timestamp && (
                <Text className="mt-0.5 font-raleway text-xs text-gray-400">
                  {formatDateTime(event.timestamp, event.timestamp)}
                </Text>
              )}
              {event.description && (
                <Text className="mt-0.5 font-raleway text-xs text-gray-400">
                  {event.description}
                </Text>
              )}
            </View>
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
