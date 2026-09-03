import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { auth } from '../lib/firebase';
import { api, routes } from '../lib/api';
import { useUser } from '../lib/useUser';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
import { usePincode } from '../lib/usePincode';
import { bookingKey, isWarehouseComplete, generateOrderId, EMPTY_WAREHOUSE } from '../lib/shipments';
import { WarehouseForm } from '../components/WarehouseForm';
import type { WarehouseData } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';
import {
  onlyDigits,
  onlyDecimal,
  checkPincode,
  checkMobile,
  checkNumberInRange,
  firstError,
  LIMITS,
} from '../lib/inputs';

type Step = 'form' | 'rates' | 'success';

interface RateItem {
  carrier_id: string;
  carrier_name: string;
  freight_charge: number;
  estimated_days?: number;
}

export default function CreateReverseShipmentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useUser();
  const { confirm, confirmDialog } = useConfirm();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<RateItem[]>([]);
  const [result, setResult] = useState<any>(null);

  // On a reverse shipment the roles invert: the *customer* is the pickup point
  // and the warehouse is the destination. The server still reads the customer
  // side from the flat `address`/`city`/`state`/`pincode` fields, and the
  // warehouse from the `return*` fields.
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    weight: '',
    length: '',
    breadth: '',
    height: '',
    productName: '',
    orderValue: '',
    orderId: '',
    reason: 'Customer Return',
  });

  // Defaults to the saved warehouse; an edit takes over as an override so the
  // profile value can load in without an effect racing the user's typing.
  const [warehouseEdit, setWarehouseEdit] = useState<WarehouseData | null>(null);
  const warehouse: WarehouseData =
    warehouseEdit ?? { ...EMPTY_WAREHOUSE, ...(user?.warehouseData || {}) };

  // The customer's city/state resolve from their pincode; derived so a typed
  // value always takes precedence.
  const { info: pickupInfo } = usePincode(form.pincode);
  const city = form.city || pickupInfo?.city || '';
  const state = form.state || pickupInfo?.state || '';

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleGetRates = async () => {
    // Same reasoning as the forward screen: validate before the rates list, so
    // choosing a courier is never undone by a field error. A return is always
    // prepaid, so order value is not required here.
    const problem = firstError([
      checkPincode(form.pincode, "Customer's pincode"),
      checkPincode(warehouse.pincode, 'Warehouse pincode'),
      form.customerName.trim() ? null : "Customer's name is required.",
      checkMobile(form.customerPhone, "Customer's phone"),
      form.address.trim() ? null : 'Pickup address is required.',
      checkNumberInRange(form.weight, LIMITS.weightKg, 'Weight', ' kg'),
      form.length ? checkNumberInRange(form.length, LIMITS.dimensionCm, 'Length', ' cm') : null,
      form.breadth ? checkNumberInRange(form.breadth, LIMITS.dimensionCm, 'Width', ' cm') : null,
      form.height ? checkNumberInRange(form.height, LIMITS.dimensionCm, 'Height', ' cm') : null,
    ]);

    if (problem) {
      toast.warning('Check the form', problem);
      return;
    }
    setLoading(true);
    try {
      const data = await api.post(routes.rates, {
        // Reverse leg: collected from the customer, delivered to the warehouse.
        pickupPincode: form.pincode,
        deliveryPincode: warehouse.pincode,
        weight: form.weight,
        length: form.length || '10',
        breadth: form.breadth || '10',
        height: form.height || '10',
        paymentType: 'prepaid',
        codAmount: '0',
      });
      if (data.success && Array.isArray(data.data)) {
        setRates(data.data.map((r: any) => ({
          carrier_id: r.carrier_id,
          carrier_name: r.carrier_name || r.carrier_id,
          freight_charge: r.freight_charge,
          estimated_days: r.estimated_days,
        })));
        setStep('rates');
      } else {
        toast.error('Error', 'Could not fetch rates.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to get rates');
    } finally {
      setLoading(false);
    }
  };

  /** Guards first, then confirm — the return is billed the moment it books. */
  const handleBook = (rate: RateItem) => {
    if (!auth.currentUser) return;
    if ((user?.walletBalance || 0) < rate.freight_charge) {
      toast.error('Insufficient Balance', `Need ₹${rate.freight_charge}, have ₹${(user?.walletBalance || 0).toFixed(2)}`);
      return;
    }
    if (!isWarehouseComplete(warehouse)) {
      toast.error(
        'Return Address Required',
        'Add a complete warehouse address (name, phone, address, city, state, pincode) before booking a return.'
      );
      return;
    }

    confirm(
      {
        title: 'Confirm Return',
        message: `Are you sure you want to return this order? ${rate.carrier_name} will collect it from the customer and ₹${rate.freight_charge} will be deducted from your wallet.`,
        confirmText: 'Yes, Return Order',
      },
      () => bookReturn(rate)
    );
  };

  /**
   * Books through the payments server rather than debiting here. Same reasoning
   * as the forward booking: a client permitted to write its own `walletBalance`
   * is a client permitted to top it up for free, so the money side has to sit
   * behind a Firebase-verified endpoint.
   */
  const bookReturn = async (rate: RateItem) => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const finalOrderId = form.orderId || generateOrderId('RET');
      const orderValue = parseFloat(form.orderValue) || 1;

      const res = await api.post(routes.bookShipment, {
        idempotencyKey: bookingKey(finalOrderId, rate.carrier_id),
        carrierId: rate.carrier_id,
        quotedCharge: rate.freight_charge,
        // Flips the priced legs: collected from the customer, returned to the
        // warehouse. The server builds the courier payload from this.
        isReverse: true,

        orderId: finalOrderId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone,
        address: form.address,
        city,
        state: state || city,
        pincode: form.pincode,
        weight: parseFloat(form.weight) || 0.5,
        length: parseFloat(form.length) || 10,
        breadth: parseFloat(form.breadth) || 10,
        height: parseFloat(form.height) || 10,

        pickupLocationName: warehouse.name,
        pickupAddress: warehouse.address,
        pickupCity: warehouse.city,
        pickupState: warehouse.state,
        pickupPincode: warehouse.pincode,
        pickupPhone: warehouse.phone,

        paymentMethod: 'Prepaid',
        orderValue,
        productName: form.productName || 'Return Item',
        returnReason: form.reason,
      });

      toast.success('Return Booked!', `AWB: ${res.awb}`);
      setResult({ awb: res.awb, courier: res.courier || rate.carrier_name, charge: res.charge });
      setStep('success');
    } catch (err: any) {
      toast.error('Booking Failed', err?.message || 'Could not book reverse shipment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => step === 'form' ? navigation.goBack() : setStep('form')}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900 flex-1">
          {step === 'form' ? 'Create Return' : step === 'rates' ? 'Select Courier' : 'Booked!'}
        </Text>
      </View>

      {loading && step !== 'form' ? (
        <LoadingSpinner fullScreen message="Processing..." />
      ) : step === 'form' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }} className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3 mt-2">
            Collect From Customer
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 gap-3" style={{ elevation: 1 }}>
            <Field label="Customer Name" value={form.customerName} onChange={(v) => update('customerName', v)} placeholder="Name" icon="user" />
            <Field label="Phone" value={form.customerPhone} onChange={(v) => update('customerPhone', onlyDigits(v, 10))} placeholder="9876543210" icon="phone" keyboardType="number-pad" maxLength={10} autoComplete="tel" />
            <Field label="Pickup Address" value={form.address} onChange={(v) => update('address', v)} placeholder="Full address" icon="map-pin" multiline />
            <Field label="Pickup Pincode" value={form.pincode} onChange={(v) => update('pincode', onlyDigits(v, 6))} placeholder="400001" keyboardType="number-pad" maxLength={6} />
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label="City" value={city} onChange={(v) => update('city', v)} placeholder="City" /></View>
              <View className="flex-1"><Field label="State" value={state} onChange={(v) => update('state', v)} placeholder="State" /></View>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-black text-gray-400 uppercase tracking-wider">
              Return To Warehouse
            </Text>
            {!isWarehouseComplete(warehouse) && (
              <View className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                <Text className="text-[9px] font-black text-amber-700">REQUIRED</Text>
              </View>
            )}
          </View>
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
            <WarehouseForm value={warehouse} onChange={setWarehouseEdit} />
          </View>

          <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Package</Text>
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 gap-3" style={{ elevation: 1 }}>
            <Field label="Product" value={form.productName} onChange={(v) => update('productName', v)} placeholder="Product name" icon="package" />
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label="Weight (kg)" value={form.weight} onChange={(v) => update('weight', onlyDecimal(v, 4, 3))} placeholder="0.5" keyboardType="decimal-pad" maxLength={8} /></View>
              <View className="flex-1"><Field label="Value (₹)" value={form.orderValue} onChange={(v) => update('orderValue', onlyDigits(v, 8))} placeholder="500" keyboardType="number-pad" maxLength={8} /></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label="L (cm)" value={form.length} onChange={(v) => update('length', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} /></View>
              <View className="flex-1"><Field label="W (cm)" value={form.breadth} onChange={(v) => update('breadth', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} /></View>
              <View className="flex-1"><Field label="H (cm)" value={form.height} onChange={(v) => update('height', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} /></View>
            </View>
            <Field label="Reason" value={form.reason} onChange={(v) => update('reason', v)} placeholder="Customer Return" />
          </View>

          <TouchableOpacity onPress={handleGetRates} disabled={loading} activeOpacity={0.8} className={`bg-violet-700 py-4 rounded-xl items-center mb-8 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''}`} style={{ elevation: 4 }}>
            <Text className="text-white font-raleway-bold text-sm">{loading ? 'Fetching Rates...' : 'Get Return Rates'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : step === 'rates' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }} className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider mb-4 mt-2">Available ({rates.length})</Text>
          {rates.sort((a, b) => a.freight_charge - b.freight_charge).map((rate) => (
            <TouchableOpacity key={rate.carrier_id} onPress={() => handleBook(rate)} disabled={loading} activeOpacity={0.7} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100/90 flex-row items-center justify-between shadow-sm" style={{ elevation: 2 }}>
              <View className="flex-row items-center gap-3 flex-1">
                <CourierLogo name={rate.carrier_name} />
                <View className="flex-1">
                  <Text className="font-raleway-bold text-gray-900 text-sm">{rate.carrier_name}</Text>
                  {rate.estimated_days && <Text className="text-xs font-raleway text-gray-400 mt-0.5">Est. {rate.estimated_days} days</Text>}
                </View>
              </View>
              <View className="items-end">
                <Text className="text-lg font-raleway-bold text-gray-900">₹{rate.freight_charge}</Text>
                <Text className="text-[10px] font-raleway-bold text-purple-600 uppercase">Book</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-emerald-50 border border-emerald-100 w-20 h-20 rounded-3xl items-center justify-center mb-6">
            <Feather name="check-circle" size={36} color="#059669" />
          </View>
          <Text className="text-2xl font-raleway-bold text-gray-900 mb-2 tracking-tight">Return Booked!</Text>
          <Text className="text-gray-500 font-raleway text-sm text-center mb-1">AWB: {result?.awb}</Text>
          <Text className="text-gray-500 font-raleway text-sm text-center mb-1">Courier: {result?.courier}</Text>
          <Text className="text-gray-500 font-raleway text-sm text-center mb-6">Charge: ₹{result?.charge}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} className="bg-violet-700 px-8 py-3.5 rounded-xl shadow-md shadow-purple-900/20" style={{ elevation: 3 }}>
            <Text className="text-white font-raleway-bold text-sm">Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {confirmDialog}
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, icon, keyboardType, maxLength, multiline, autoCapitalize, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  icon?: string; keyboardType?: any; maxLength?: number; multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; autoComplete?: any;
}) {
  return (
    <View>
      <Text className="text-xs font-raleway-bold text-gray-700 mb-1">{label}</Text>
      <View className="relative">
        {icon && <View className="absolute left-3 top-3.5 z-10"><Feather name={icon as any} size={16} color="#9ca3af" /></View>}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9ca3af" keyboardType={keyboardType} maxLength={maxLength} multiline={multiline} autoCapitalize={autoCapitalize} autoComplete={autoComplete}
          className={`bg-gray-50/90 border border-gray-200 rounded-xl ${icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2.5 text-sm font-raleway text-gray-900 ${multiline ? 'min-h-[60px]' : ''}`} />
      </View>
    </View>
  );
}
