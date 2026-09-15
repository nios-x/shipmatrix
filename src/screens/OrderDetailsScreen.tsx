import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Text } from '../components/ui/Text';
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
import { resolveLabelUrl, LabelError } from '../lib/labels';
import {
  isCod,
  codValue,
  statusPillClasses,
  formatDateTime,
  deliveryDays,
  destinationLabel,
  isCancellable,
  refundableAmount,
} from '../lib/shipments';
import { formatCurrency, formatDimensions, formatRate, formatWeight } from '../lib/format';
import { weightBreakdown } from '../lib/weight';
import { cancelOrder, CancelError } from '../lib/cancelOrder';
import { CancelOrderModal } from '../components/CancelOrderModal';
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
  const text = value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <View className={wide ? 'mb-4 w-full' : 'mb-4 w-1/2 pr-3'}>
      <Text variant="label">{label}</Text>
      <Text className="mt-1 font-medium text-[15px] leading-5 text-slate-900" selectable>
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
    <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white px-4 pt-4">
      <View className="mb-3.5 flex-row items-center gap-2">
        <Feather name={icon} size={15} color="#64748B" />
        <Text variant="heading" className="text-[15px]">
          {title}
        </Text>
      </View>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}

/** One of the headline figures under the courier: freight, value, weight. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 px-1">
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="value" className="mt-1 text-base" numberOfLines={1}>
        {value}
      </Text>
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

  // Resolving a Delhivery label needs a round trip, so the button reports its
  // own progress rather than looking dead while that request is in flight.
  const [labelLoading, setLabelLoading] = useState(false);

  // Cancelling releases the AWB at the courier and credits the wallet back, so
  // it asks for a reason first and reports progress until both have landed.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const openLabel = async () => {
    if (!shipment || labelLoading) return;
    setLabelLoading(true);
    try {
      const url = await resolveLabelUrl(shipment);
      await Linking.openURL(url);
    } catch (e: any) {
      if (e instanceof LabelError) {
        toast.warning('No label yet', e.message);
      } else {
        toast.error('Could not open label', 'No app on this device can open the link.');
      }
    } finally {
      setLabelLoading(false);
    }
  };

  /**
   * The courier is asked first: `cancelOrder` leaves the record and the wallet
   * untouched unless it accepts, so a refusal here means nothing changed and
   * the sheet stays open to retry.
   */
  const handleCancel = async (reason: string) => {
    if (!shipment || cancelling) return;
    setCancelling(true);
    try {
      const refunded = await cancelOrder(shipment, reason);
      setCancelOpen(false);
      toast.success(
        'Order Cancelled',
        refunded > 0
          ? `${formatCurrency(refunded)} has been refunded to your wallet.`
          : 'The courier has released this AWB.'
      );
    } catch (e: any) {
      toast.error(
        'Could not cancel',
        e instanceof CancelError ? e.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const header = (
    <View
      className="flex-row items-center gap-3 border-b border-slate-100 bg-white px-5 pb-3.5"
      style={{ paddingTop: insets.top + 16 }}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
        <Feather name="arrow-left" size={20} color="#334155" />
      </TouchableOpacity>
      <View className="flex-1">
        <Text variant="title">Order Details</Text>
        {!!shipment?.orderId && (
          <Text variant="meta" className="mt-0.5" numberOfLines={1} selectable>
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
  const dimensions = formatDimensions(shipment.length, shipment.breadth, shipment.height);
  const parcel = weightBreakdown(
    shipment.weight,
    shipment.length,
    shipment.breadth,
    shipment.height
  );
  const hasAwb = !!shipment.awb;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {header}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          padding: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Courier, status and the figures a seller checks first */}
        <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <View className="flex-row items-start">
            <CourierLogo name={shipment.courier || 'Unknown'} />
            <View className="ml-3 mr-2 flex-1">
              <Text variant="cardTitle" numberOfLines={2}>
                {shipment.courier || 'Unknown Courier'}
              </Text>
              <Text variant="meta" className="mt-1" selectable numberOfLines={1}>
                AWB {shipment.awb || '—'}
              </Text>
            </View>
            <View className={`h-6 justify-center rounded-md px-2 ${statusBg}`}>
              <Text
                className={`font-semibold text-[11px] uppercase tracking-wide ${statusText}`}
                numberOfLines={1}>
                {shipment.status || 'Unknown'}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row border-t border-slate-100 pt-3.5">
            <Figure
              label="Freight"
              value={shipment.freightCharge != null ? formatRate(shipment.freightCharge) : '—'}
            />
            <Figure
              label="Order value"
              value={shipment.orderValue != null ? formatCurrency(shipment.orderValue) : '—'}
            />
            <Figure label="Chargeable" value={formatWeight(parcel.chargeable)} />
          </View>

          <View className="mt-4 flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => navigation.navigate('Tracking', { awb: shipment.awb })}
              activeOpacity={0.85}
              disabled={!hasAwb}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasAwb }}
              className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${
                hasAwb ? 'bg-violet-600' : 'bg-slate-100'
              }`}>
              <Feather name="map-pin" size={15} color={hasAwb ? '#FFFFFF' : '#94A3B8'} />
              <Text variant="button" className={hasAwb ? 'text-white' : 'text-slate-400'}>
                Track
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openLabel}
              activeOpacity={0.85}
              disabled={!hasAwb || labelLoading}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasAwb, busy: labelLoading }}
              className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border ${
                hasAwb ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
              }`}>
              <Feather name="download" size={15} color={hasAwb ? '#334155' : '#94A3B8'} />
              <Text variant="button" className={hasAwb ? 'text-slate-800' : 'text-slate-400'}>
                {labelLoading ? 'Opening…' : 'Label'}
              </Text>
            </TouchableOpacity>
          </View>

          {isCancellable(shipment) && (
            <TouchableOpacity
              onPress={() => setCancelOpen(true)}
              activeOpacity={0.85}
              disabled={cancelling}
              accessibilityRole="button"
              className="mt-2.5 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50">
              <Feather name="x-circle" size={15} color="#E11D48" />
              <Text variant="button" className="text-rose-700">
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Section icon="file-text" title="Order">
          <Field label="Order ID" value={shipment.orderId} />
          <Field
            label="Payment"
            value={isCod(shipment) ? `COD · ${formatCurrency(codValue(shipment))}` : 'Prepaid'}
          />
          <Field label="Created" value={formatDateTime(shipment.createdAt)} />
          <Field
            label="Delivered"
            value={
              shipment.deliveredAt
                ? `${formatDateTime(shipment.deliveredAt)}${
                    days != null ? ` · ${Math.max(1, Math.round(days))}d` : ''
                  }`
                : null
            }
          />
          {!!shipment.isReverse && (
            <Field label="Return Reason" value={shipment.returnReason} wide />
          )}
          {!!shipment.cancelReason && (
            <Field label="Cancel Reason" value={shipment.cancelReason} wide />
          )}
        </Section>

        <Section icon="package" title="Package">
          <Field label="Product" value={shipment.productName} />
          <Field label="Actual weight" value={formatWeight(shipment.weight, '')} />
          <Field label="Dimensions" value={dimensions} />
          <Field
            label="Volumetric weight"
            value={parcel.volumetric > 0 ? formatWeight(parcel.volumetric) : null}
          />
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
            <Field
              label="Remitted On"
              value={shipment.remittedAt ? formatDateTime(shipment.remittedAt) : null}
            />
          </Section>
        )}
      </ScrollView>

      {cancelOpen && (
        <CancelOrderModal
          awb={shipment.awb}
          refund={refundableAmount(shipment)}
          submitting={cancelling}
          onClose={() => setCancelOpen(false)}
          onConfirm={handleCancel}
        />
      )}
    </View>
  );
}
