import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { OrdersStackParamList } from '../navigation/types';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../lib/alert';
import {
  isCod,
  codValue,
  statusPillClasses,
  formatDateTime,
  deliveryDays,
  destinationLabel,
} from '../lib/shipments';
import type { Shipment } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Nav = NativeStackNavigationProp<OrdersStackParamList, 'OrderDetails'>;
type Route = RouteProp<OrdersStackParamList, 'OrderDetails'>;

/** A labelled value. Empty values collapse to an em dash rather than a gap. */
function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string | number | null;
  wide?: boolean;
}) {
  const text =
    value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <View className={wide ? 'w-full mb-4' : 'w-1/2 mb-4 pr-3'}>
      <Text className="text-[10px] text-slate-400 font-raleway-bold uppercase tracking-wider">
        {label}
      </Text>
      <Text className="text-sm font-raleway-semibold text-slate-800 mt-1" selectable>
        {text}
      </Text>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-slate-100">
      <View className="flex-row items-center gap-2 mb-3.5">
        <View className="w-7 h-7 rounded-lg bg-slate-50 items-center justify-center">
          <Feather name={icon} size={14} color="#64748B" />
        </View>
        <Text className="text-xs font-raleway-bold text-slate-900 uppercase tracking-wider">
          {title}
        </Text>
      </View>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { shipments, loading } = useShipments();

  // Read from the live list rather than a route param, so a status change
  // pushed by the Firestore listener updates this screen while it is open.
  const shipment = useMemo(
    () => shipments.find((s) => s.id === params.shipmentId),
    [shipments, params.shipmentId]
  );

  const openLabel = () => {
    if (!shipment?.labelUrl) return;
    Linking.openURL(shipment.labelUrl).catch(() =>
      toast.error('Could not open label', 'No app on this device can open the link.')
    );
  };

  const header = (
    <View
      className="px-5 pb-3.5 bg-white border-b border-slate-100 flex-row items-center gap-3"
      style={{ paddingTop: insets.top + 16 }}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        className="w-10 h-10 rounded-xl bg-white border border-slate-100 items-center justify-center"
      >
        <Feather name="arrow-left" size={20} color="#1F2937" />
      </TouchableOpacity>
      <View className="flex-1">
        <Text className="text-xl font-raleway-bold text-slate-900 tracking-tight">
          Order Details
        </Text>
        {!!shipment?.orderId && (
          <Text className="text-xs text-slate-500 font-raleway-medium mt-0.5">
            {shipment.orderId}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen message="Loading order..." />;

  if (!shipment) {
    return (
      <View className="flex-1 bg-[#F8FAFC]">
        {header}
        <EmptyState
          title="Order not found"
          subtitle="This shipment may have been removed, or it belongs to another account."
          actionLabel="Back to Orders"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const [statusBg, statusText] = statusPillClasses(shipment);
  const days = deliveryDays(shipment);
  const dimensions =
    shipment.length && shipment.breadth && shipment.height
      ? `${shipment.length} × ${shipment.breadth} × ${shipment.height} cm`
      : null;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Courier + status */}
        <View className="bg-white rounded-2xl p-4 mb-3 border border-slate-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <CourierLogo name={shipment.courier || 'Unknown'} />
              <View className="flex-1">
                <Text className="font-raleway-bold text-slate-900 text-sm">
                  {shipment.courier || 'Unknown Courier'}
                </Text>
                <Text className="text-xs text-slate-400 font-raleway-medium mt-0.5" selectable>
                  AWB: {shipment.awb || 'N/A'}
                </Text>
              </View>
            </View>
            <View className={`px-2.5 py-1 rounded-full ${statusBg}`}>
              <Text
                className={`text-[10px] font-raleway-black uppercase tracking-wider ${statusText}`}
              >
                {shipment.status || 'Unknown'}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2.5 mt-4">
            <TouchableOpacity
              onPress={() => navigation.navigate('Tracking', { awb: shipment.awb })}
              activeOpacity={0.8}
              disabled={!shipment.awb}
              className={`flex-1 h-11 rounded-xl flex-row items-center justify-center gap-2 ${
                shipment.awb ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            >
              <Feather name="map-pin" size={15} color="#FFFFFF" />
              <Text className="text-xs font-raleway-bold text-white">Track</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openLabel}
              activeOpacity={0.8}
              disabled={!shipment.labelUrl}
              className={`flex-1 h-11 rounded-xl flex-row items-center justify-center gap-2 border ${
                shipment.labelUrl ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <Feather
                name="download"
                size={15}
                color={shipment.labelUrl ? '#334155' : '#94A3B8'}
              />
              <Text
                className={`text-xs font-raleway-bold ${
                  shipment.labelUrl ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                Label
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Section icon="file-text" title="Order">
          <Field label="Order ID" value={shipment.orderId} />
          <Field label="Payment" value={isCod(shipment) ? `COD ₹${codValue(shipment)}` : 'Prepaid'} />
          <Field label="Order Value" value={shipment.orderValue != null ? `₹${shipment.orderValue}` : null} />
          <Field
            label="Freight Charge"
            value={shipment.freightCharge != null ? `₹${shipment.freightCharge}` : null}
          />
          <Field label="Created" value={formatDateTime(shipment.createdAt)} />
          <Field
            label="Delivered"
            value={
              shipment.deliveredAt
                ? `${formatDateTime(shipment.deliveredAt)}${days != null ? ` (${days}d)` : ''}`
                : null
            }
          />
          {!!shipment.isReverse && (
            <Field label="Return Reason" value={shipment.returnReason} wide />
          )}
        </Section>

        <Section icon="package" title="Package">
          <Field label="Product" value={shipment.productName} />
          <Field label="Weight" value={shipment.weight != null ? `${shipment.weight} kg` : null} />
          <Field label="Dimensions" value={dimensions} wide />
        </Section>

        <Section icon="user" title="Customer">
          <Field label="Name" value={shipment.customerName} />
          <Field label="Phone" value={shipment.customerPhone} />
          <Field label="Email" value={shipment.customerEmail} wide />
        </Section>

        <Section icon="map-pin" title="Deliver To">
          <Field label="Address" value={shipment.address} wide />
          <Field label="City" value={shipment.city} />
          <Field label="State" value={shipment.state} />
          <Field label="Pincode" value={shipment.pincode} />
          <Field label="Destination" value={destinationLabel(shipment)} />
        </Section>

        <Section icon="home" title="Pickup From">
          <Field label="Warehouse" value={shipment.pickupLocationName} wide />
          <Field label="Address" value={shipment.pickupAddress} wide />
          <Field label="City" value={shipment.pickupCity} />
          <Field label="State" value={shipment.pickupState} />
          <Field label="Pincode" value={shipment.pickupPincode} />
          <Field label="Phone" value={shipment.pickupPhone} />
        </Section>

        {isCod(shipment) && (
          <Section icon="credit-card" title="COD Remittance">
            <Field label="Status" value={shipment.remittanceStatus || 'Pending'} />
            <Field label="Remitted On" value={shipment.remittedAt ? formatDateTime(shipment.remittedAt) : null} />
          </Section>
        )}
      </ScrollView>
    </View>
  );
}
