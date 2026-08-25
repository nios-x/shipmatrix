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
import { doc, addDoc, collection, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useUser } from '../lib/useUser';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomAlertModal } from '../components/CustomAlertModal';
import { toast } from '../lib/alert';

type Step = 'form' | 'rates' | 'booking';

interface RateItem {
  carrier_id: string;
  carrier_name: string;
  freight_charge: number;
  estimated_days?: number;
}

export default function CreateShipmentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useUser();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<RateItem[]>([]);
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Form fields
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryPincode: '',
    pickupPincode: '',
    weight: '',
    length: '',
    breadth: '',
    height: '',
    productName: '',
    productValue: '',
    paymentType: 'prepaid' as 'prepaid' | 'cod',
    codAmount: '',
    orderId: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGetRates = async () => {
    if (!form.pickupPincode || !form.deliveryPincode || !form.weight) {
      toast.warning('Missing Info', 'Please fill pickup pincode, delivery pincode, and weight.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/rates', {
        pickupPincode: form.pickupPincode,
        deliveryPincode: form.deliveryPincode,
        weight: form.weight,
        length: form.length || '10',
        breadth: form.breadth || '10',
        height: form.height || '10',
        paymentType: form.paymentType,
        codAmount: form.paymentType === 'cod' ? form.codAmount : '0',
      });

      if (data.success && Array.isArray(data.data)) {
        setRates(
          data.data.map((r: any) => ({
            carrier_id: r.carrier_id,
            carrier_name: r.carrier_name || r.carrier_id,
            freight_charge: r.freight_charge,
            estimated_days: r.estimated_days,
          }))
        );
        setStep('rates');
      } else {
        toast.error('Error', 'Could not fetch rates. Please try again.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to get rates');
    } finally {
      setLoading(false);
    }
  };

  const handleBookShipment = async (rate: RateItem) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Check wallet balance
    if ((user?.walletBalance || 0) < rate.freight_charge) {
      toast.error(
        'Insufficient Balance',
        `You need ₹${rate.freight_charge} but have ₹${(user?.walletBalance || 0).toFixed(2)}. Please recharge your wallet.`
      );
      return;
    }

    setLoading(true);
    try {
      // Determine courier endpoint
      const courierMap: Record<string, string> = {
        delhivery: 'delhivery',
        delhivery_surface: 'delhivery',
        ekart: 'ekart',
        xpressbees: 'xpressbees',
        xpressbees_air: 'xpressbees',
        shadowfax: 'shadowfax',
        shadowfax_360: 'shadowfax_360',
        shreemaruti: 'shreemaruti',
        shreemaruti_air: 'shreemaruti',
        amazon: 'amazon',
        amazon_express: 'amazon',
      };

      const baseCourier = courierMap[rate.carrier_id] || rate.carrier_id;

      const shipmentData = {
        ...form,
        courier: rate.carrier_name,
        carrier_id: rate.carrier_id,
        freight_charge: rate.freight_charge,
        userId: uid,
        userName: user?.name,
        userEmail: user?.email,
        userPhone: user?.phone,
      };

      const res = await api.post(`/api/${baseCourier}/create-shipment`, shipmentData);

      if (res.success || res.awb) {
        // Save to Firestore
        await addDoc(collection(db, `users/${uid}/shipments`), {
          ...form,
          awb: res.awb || res.tracking_id,
          courier: rate.carrier_name,
          carrierId: rate.carrier_id,
          status: 'BOOKED',
          freightCharge: rate.freight_charge,
          labelUrl: res.label_url || '',
          shipmentId: res.shipment_id || '',
          pkgRefId: res.pkg_ref_id || '',
          createdAt: serverTimestamp(),
        });

        // Deduct wallet
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          walletBalance: increment(-rate.freight_charge),
        });

        // Record transaction
        await addDoc(collection(db, `users/${uid}/transactions`), {
          type: 'debit',
          amount: rate.freight_charge,
          description: `Shipment booked - ${rate.carrier_name} - AWB: ${res.awb || res.tracking_id}`,
          createdAt: serverTimestamp(),
        });

        toast.success('Shipment Booked!', `AWB: ${res.awb || res.tracking_id}`);

        setBookingResult({
          ...res,
          courier: rate.carrier_name,
          charge: rate.freight_charge,
        });
        setStep('booking');
      } else {
        toast.error('Booking Failed', res.error || 'Could not book shipment.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Customer Details */}
      <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3 mt-2">
        Customer Details
      </Text>
      <View className=" border-gray-100 mb-4 gap-3">
        <InputField label="Name" value={form.customerName} onChangeText={(v) => updateField('customerName', v)} placeholder="Customer name" icon="user" />
        <InputField label="Phone" value={form.customerPhone} onChangeText={(v) => updateField('customerPhone', v)} placeholder="9876543210" icon="phone" keyboardType="phone-pad" />
        <InputField label="Email" value={form.customerEmail} onChangeText={(v) => updateField('customerEmail', v)} placeholder="customer@email.com" icon="mail" keyboardType="email-address" />
      </View>

      {/* Delivery Address */}
      <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">
        Delivery Address
      </Text>
      <View className=" border border-gray-100 mb-4 gap-3">
        <InputField label="Address" value={form.deliveryAddress} onChangeText={(v) => updateField('deliveryAddress', v)} placeholder="Full address" icon="map-pin" multiline />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="City" value={form.deliveryCity} onChangeText={(v) => updateField('deliveryCity', v)} placeholder="City" />
          </View>
          <View className="flex-1">
            <InputField label="State" value={form.deliveryState} onChangeText={(v) => updateField('deliveryState', v)} placeholder="State" />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="Delivery Pincode" value={form.deliveryPincode} onChangeText={(v) => updateField('deliveryPincode', v)} placeholder="110001" keyboardType="number-pad" maxLength={6} />
          </View>
          <View className="flex-1">
            <InputField label="Pickup Pincode" value={form.pickupPincode} onChangeText={(v) => updateField('pickupPincode', v)} placeholder="400001" keyboardType="number-pad" maxLength={6} />
          </View>
        </View>
      </View>

      {/* Package Details */}
      <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">
        Package Details
      </Text>
      <View className="  border border-gray-100 mb-4 gap-3">
        <InputField label="Product Name" value={form.productName} onChangeText={(v) => updateField('productName', v)} placeholder="Product description" icon="package" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="Weight (kg)" value={form.weight} onChangeText={(v) => updateField('weight', v)} placeholder="0.5" keyboardType="decimal-pad" />
          </View>
          <View className="flex-1">
            <InputField label="Value (₹)" value={form.productValue} onChangeText={(v) => updateField('productValue', v)} placeholder="500" keyboardType="number-pad" />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="L (cm)" value={form.length} onChangeText={(v) => updateField('length', v)} placeholder="10" keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <InputField label="W (cm)" value={form.breadth} onChangeText={(v) => updateField('breadth', v)} placeholder="10" keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <InputField label="H (cm)" value={form.height} onChangeText={(v) => updateField('height', v)} placeholder="10" keyboardType="number-pad" />
          </View>
        </View>

        {/* Payment Type */}
        <Text className="text-xs font-semibold text-gray-600 mb-1">Payment Type</Text>
        <View className="flex-row gap-3">
          {(['prepaid', 'cod'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => updateField('paymentType', type)}
              className={`flex-1 py-3 rounded-xl border items-center ${form.paymentType === type ? 'bg-purple-900 border-purple-600' : 'bg-white border-gray-300'
                }`}
            >
              <Text className={`font-bold ${form.paymentType === type ? 'text-white' : 'text-gray-700'}`}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.paymentType === 'cod' && (
          <InputField label="COD Amount (₹)" value={form.codAmount} onChangeText={(v) => updateField('codAmount', v)} placeholder="1000" keyboardType="number-pad" />
        )}

        <InputField label="Order ID (Optional)" value={form.orderId} onChangeText={(v) => updateField('orderId', v)} placeholder="ORD-12345" />
      </View>

      {/* Get Rates Button */}
      <TouchableOpacity
        onPress={handleGetRates}
        disabled={loading}
        activeOpacity={0.8}
        className={`bg-purple-900 py-4 rounded-xl items-center mb-8 ${loading ? 'opacity-70' : ''}`}
        
      >
        <Text className="text-white font-bold text-base">
          {loading ? 'Fetching Rates...' : 'Get Shipping Rates'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRates = () => (
    <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
      <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4 mt-2">
        Available Couriers ({rates.length})
      </Text>

      {rates
        .sort((a, b) => a.freight_charge - b.freight_charge)
        .map((rate) => (
          <TouchableOpacity
            key={rate.carrier_id}
            onPress={() => handleBookShipment(rate)}
            disabled={loading}
            activeOpacity={0.7}
            className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row items-center justify-between"
            
          >
            <View className="flex-row items-center gap-3 flex-1">
              <CourierLogo name={rate.carrier_name} />
              <View className="flex-1">
                <Text className="font-bold text-gray-900 text-sm">{rate.carrier_name}</Text>
                {rate.estimated_days && (
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Est. {rate.estimated_days} days
                  </Text>
                )}
              </View>
            </View>
            <View className="items-end">
              <Text className="text-lg font-black text-gray-900">₹{rate.freight_charge}</Text>
              <Text className="text-[10px] font-bold text-purple-600 uppercase">Book Now</Text>
            </View>
          </TouchableOpacity>
        ))}

      <View className="h-8" />
    </ScrollView>
  );

  const renderBookingSuccess = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="bg-green-100 w-20 h-20 rounded-full items-center justify-center mb-6">
        <Feather name="check-circle" size={40} color="#16a34a" />
      </View>
      <Text className="text-2xl font-black text-gray-900 mb-2 text-center">
        Shipment Booked!
      </Text>
      <Text className="text-gray-500 text-center mb-2">
        AWB: {bookingResult?.awb || bookingResult?.tracking_id || 'N/A'}
      </Text>
      <Text className="text-gray-500 text-center mb-1">
        Courier: {bookingResult?.courier}
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        Charge: ₹{bookingResult?.charge}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        className="bg-purple-900 px-8 py-4 rounded-xl"
        style={{ elevation: 4 }}
      >
        <Text className="text-white font-bold">Back to Orders</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
    {/* Header */}
<View className="px-5 pb-4 pt-10">
  <View className="flex-row items-center">
    <TouchableOpacity
      onPress={() =>
        step === 'form'
          ? navigation.goBack()
          : setStep(step === 'rates' ? 'form' : 'rates')
      }
      className="w-10 h-10 rounded-full bg-white items-center justify-center"
      style={{ elevation: 2 }}
    >
      <Feather name="arrow-left" size={20} color="#111827" />
    </TouchableOpacity>

    <View className="flex-1 ml-3">
      <Text className="text-2xl font-black text-gray-950">
        {step === 'form'
          ? 'Create Shipment'
          : step === 'rates'
            ? 'Choose Courier'
            : 'Shipment Confirmed'}
      </Text>

      <Text className="text-xs text-gray-500 mt-0.5">
        {step === 'form'
          ? 'Enter shipment details'
          : step === 'rates'
            ? 'Compare rates & delivery times'
            : 'Your shipment is ready'}
      </Text>
    </View>
  </View>

  {/* Progress */}
  {step !== 'booking' && (
    <View className="flex-row items-center mt-5 p-5">
      {[
        { label: 'Details', active: step === 'form' },
        { label: 'Courier', active: step === 'rates' },
      ].map((item, index) => (
        <React.Fragment key={item.label}>
          <View className="flex-row items-center">
            <View
              className={`w-7 h-7 rounded-full items-center justify-center ${
                item.active ? 'bg-purple-700' : 'bg-purple-100'
              }`}
            >
              <Text
                className={`text-xs font-black ${
                  item.active ? 'text-white' : 'text-purple-700'
                }`}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              className={`ml-2 text-xs font-bold ${
                item.active ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {item.label}
            </Text>
          </View>

          {index === 0 && (
            <View className="h-[1px] bg-gray-200 flex-1 mx-4" />
          )}
        </React.Fragment>
      ))}
    </View>
  )}
</View>
      {loading && step !== 'form' ? (
        <LoadingSpinner fullScreen message="Processing..." />
      ) : step === 'form' ? (
        renderForm()
      ) : step === 'rates' ? (
        renderRates()
      ) : (
        renderBookingSuccess()
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Reusable Input Field ─────────────────────────────
function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon?: string;
  keyboardType?: any;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-600 mb-1">{label}</Text>
      <View className="relative">
        {icon && (
          <View className="absolute left-3 top-3 z-10">
            <Feather name={icon as any} size={16} color="#9ca3af" />
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          className={`bg-gray-50 border border-gray-200 rounded-lg ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 text-sm font-medium text-gray-900 ${multiline ? 'min-h-[60px]' : ''}`}
        />
      </View>
    </View>
  );
}
