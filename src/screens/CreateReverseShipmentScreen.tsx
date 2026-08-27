import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../lib/firebase';
import { api } from '../lib/api';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { useUser } from '../lib/useUser';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import { usePincode } from '../lib/usePincode';
import { courierEndpoint, isWarehouseComplete, generateOrderId, EMPTY_WAREHOUSE } from '../lib/shipments';
import { WarehouseForm } from '../components/WarehouseForm';
import type { WarehouseData } from '../types';

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
    if (!form.pincode || !warehouse.pincode || !form.weight) {
      toast.warning('Missing Info', "Fill the customer's pincode, your warehouse pincode, and weight.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/api/rates', {
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

  const handleBook = async (rate: RateItem) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
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

    setLoading(true);
    try {
      const finalOrderId = form.orderId || generateOrderId('RET');
      const orderValue = parseFloat(form.orderValue) || 1;

      const res = await api.post(`/api/${courierEndpoint(rate.carrier_id)}/create-shipment`, {
        orderId: finalOrderId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone,
        // Customer side — the courier collects from here.
        address: form.address,
        city,
        state: state || city,
        pincode: form.pincode,
        pickupPincode: form.pincode,
        pickupLocationName: form.customerName,
        pickupCity: city,
        pickupState: state || city,
        pickupPhone: form.customerPhone,
        pickupAddress: form.address,
        // Warehouse side — the return is delivered back here.
        returnLocationName: warehouse.name,
        returnPhone: warehouse.phone,
        returnAddress: warehouse.address,
        returnPincode: warehouse.pincode,
        returnCity: warehouse.city,
        returnState: warehouse.state,
        weight: parseFloat(form.weight) || 0.5,
        length: parseFloat(form.length) || 10,
        breadth: parseFloat(form.breadth) || 10,
        height: parseFloat(form.height) || 10,
        paymentMethod: 'prepaid',
        orderValue,
        productName: form.productName || 'Return Item',
        courier: rate.carrier_id,
        courierName: rate.carrier_name,
        isReverse: true,
      });

      if (res.success || res.awb) {
        const awb = res.awb || res.tracking_id || '';
        await addDoc(collection(db, `users/${uid}/shipments`), {
          userId: uid,
          source: 'mobile',
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
          productName: form.productName || 'Return Item',
          paymentMethod: 'Prepaid',
          orderValue,
          returnReason: form.reason,
          awb,
          courier: rate.carrier_name,
          courierName: rate.carrier_name,
          carrierId: rate.carrier_id,
          status: 'Ready to Pickup',
          isReverse: true,
          amount: rate.freight_charge,
          freightCharge: rate.freight_charge,
          labelUrl: res.labelUrl || res.label_url || res.label || '',
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'users', uid), { walletBalance: increment(-rate.freight_charge) });
        await addDoc(collection(db, `users/${uid}/transactions`), {
          type: 'debit',
          amount: rate.freight_charge,
          description: `Reverse shipment - ${rate.carrier_name} - AWB: ${awb}`,
          createdAt: serverTimestamp(),
        });
        toast.success('Return Booked!', `AWB: ${awb}`);
        setResult({ awb, courier: rate.carrier_name, charge: rate.freight_charge });
        setStep('success');
      } else {
        toast.error('Failed', res.error || 'Could not book reverse shipment.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Booking failed');
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
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3 mt-2">
            Collect From Customer
          </Text>
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 gap-3" style={{ elevation: 1 }}>
            <Field label="Customer Name" value={form.customerName} onChange={(v) => update('customerName', v)} placeholder="Name" icon="user" />
            <Field label="Phone" value={form.customerPhone} onChange={(v) => update('customerPhone', v)} placeholder="9876543210" icon="phone" keyboardType="phone-pad" />
            <Field label="Pickup Address" value={form.address} onChange={(v) => update('address', v)} placeholder="Full address" icon="map-pin" multiline />
            <Field label="Pickup Pincode" value={form.pincode} onChange={(v) => update('pincode', v)} placeholder="400001" keyboardType="number-pad" maxLength={6} />
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
              <View className="flex-1"><Field label="Weight (kg)" value={form.weight} onChange={(v) => update('weight', v)} placeholder="0.5" keyboardType="decimal-pad" /></View>
              <View className="flex-1"><Field label="Value (₹)" value={form.orderValue} onChange={(v) => update('orderValue', v)} placeholder="500" keyboardType="number-pad" /></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label="L (cm)" value={form.length} onChange={(v) => update('length', v)} placeholder="10" keyboardType="number-pad" /></View>
              <View className="flex-1"><Field label="W (cm)" value={form.breadth} onChange={(v) => update('breadth', v)} placeholder="10" keyboardType="number-pad" /></View>
              <View className="flex-1"><Field label="H (cm)" value={form.height} onChange={(v) => update('height', v)} placeholder="10" keyboardType="number-pad" /></View>
            </View>
            <Field label="Reason" value={form.reason} onChange={(v) => update('reason', v)} placeholder="Customer Return" />
          </View>

          <TouchableOpacity onPress={handleGetRates} disabled={loading} activeOpacity={0.8} className={`bg-violet-700 py-4 rounded-xl items-center mb-8 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''}`} style={{ elevation: 4 }}>
            <Text className="text-white font-raleway-bold text-sm">{loading ? 'Fetching Rates...' : 'Get Return Rates'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : step === 'rates' ? (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
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
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, icon, keyboardType, maxLength, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  icon?: string; keyboardType?: any; maxLength?: number; multiline?: boolean;
}) {
  return (
    <View>
      <Text className="text-xs font-raleway-bold text-gray-700 mb-1">{label}</Text>
      <View className="relative">
        {icon && <View className="absolute left-3 top-3.5 z-10"><Feather name={icon as any} size={16} color="#9ca3af" /></View>}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9ca3af" keyboardType={keyboardType} maxLength={maxLength} multiline={multiline}
          className={`bg-gray-50/90 border border-gray-200 rounded-xl ${icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2.5 text-sm font-raleway text-gray-900 ${multiline ? 'min-h-[60px]' : ''}`} />
      </View>
    </View>
  );
}
