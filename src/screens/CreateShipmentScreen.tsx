import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../lib/firebase';
import { api, routes } from '../lib/api';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../lib/useUser';
import { RateCard } from '../components/RateCard';
import { BoxScanner } from '../components/BoxScanner';
import { ScanButton } from '../components/DimensionCalculator';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatCurrency, formatRate, formatWeight } from '../lib/format';
import { weightBreakdown } from '../lib/weight';
import { useConfirm } from '../components/useConfirm';
import { toast } from '../lib/alert';
import { usePincode } from '../lib/usePincode';
import {
  bookingKey,
  warehousePayload,
  isWarehouseComplete,
  generateOrderId,
  EMPTY_WAREHOUSE,
} from '../lib/shipments';
import { WarehouseForm } from '../components/WarehouseForm';
import type { WarehouseData } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';
import { parseRates, type RateResult } from '../lib/rates';
import {
  onlyDigits,
  onlyDecimal,
  singleSpaced,
  checkPincode,
  checkMobile,
  checkOptionalEmail,
  checkNumberInRange,
  firstError,
  LIMITS,
} from '../lib/inputs';

type Step = 'form' | 'rates' | 'booking';

type RateItem = RateResult;

export default function CreateShipmentScreen({ navigation: propNavigation, route: propRoute }: any = {}) {
  const insets = useSafeAreaInsets();
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const navigation = propNavigation || hookNavigation;
  const route = propRoute || hookRoute;
  const { user } = useUser();
  const { confirm, confirmDialog } = useConfirm();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<RateItem[]>([]);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  // Form fields. Names mirror the `/api/{courier}/create-shipment` contract so
  // the payload can be sent through without a translation layer.
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
    paymentMethod: 'Prepaid' as 'Prepaid' | 'COD',
    orderId: '',
  });

  // Pickup warehouse — the courier APIs require a registered pickup location,
  // so it defaults to the one saved on the profile. Held as an optional
  // override rather than mirrored into state, so the saved warehouse shows up
  // as soon as the profile loads without an effect racing the user's edits.
  const [warehouseEdit, setWarehouseEdit] = useState<WarehouseData | null>(null);
  const warehouse: WarehouseData = warehouseEdit ?? {
    ...EMPTY_WAREHOUSE,
    ...(user?.warehouseData || {}),
    ...(route.params?.pickupPincode && !user?.warehouseData?.pincode
      ? { pincode: String(route.params.pickupPincode) }
      : {}),
  };

  // Prefill from navigation params (a rate picked in the calculator, a return
  // of an existing order). Applied while rendering, once per new params object,
  // rather than from an effect that would paint the empty form first.
  const [appliedParams, setAppliedParams] = useState<unknown>(null);
  if (route.params && route.params !== appliedParams) {
    setAppliedParams(route.params);
    const p = route.params;
    setForm((prev) => ({
      ...prev,
      pincode: p.deliveryPincode || prev.pincode,
      weight: p.weight ? String(p.weight) : prev.weight,
      length: p.length ? String(p.length) : prev.length,
      breadth: p.breadth || p.width ? String(p.breadth || p.width) : prev.breadth,
      height: p.height ? String(p.height) : prev.height,
      orderId: p.orderId || prev.orderId,
    }));
  }

  // Destination city/state resolve from the pincode, matching the web. Derived
  // rather than copied into the form so a typed value always wins.
  const { info: destInfo, loading: resolvingCity } = usePincode(form.pincode);
  const city = form.city || destInfo?.city || '';
  const state = form.state || destInfo?.state || '';

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const [savingWarehouse, setSavingWarehouse] = useState(false);

  /** Persists the pickup warehouse so future bookings prefill it. */
  const handleSaveWarehouse = async () => {
    if (!auth.currentUser || !isWarehouseComplete(warehouse)) return;
    setSavingWarehouse(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { warehouseData: warehouse });
      toast.success('Saved', 'This pickup address will be used for future shipments.');
    } catch {
      toast.error('Error', 'Could not save the pickup address.');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleGetRates = async () => {
    // Everything is validated here rather than at booking: the user picks a
    // courier off the rates list, and being sent back to fix a phone number
    // after choosing one loses that choice. These bounds mirror the server's
    // schema, so anything accepted here is accepted by /api/shipments/book.
    const problem = firstError([
      checkPincode(warehouse.pincode, 'Pickup pincode'),
      checkPincode(form.pincode, 'Delivery pincode'),
      form.customerName.trim() ? null : 'Customer name is required.',
      checkMobile(form.customerPhone, 'Customer phone'),
      checkOptionalEmail(form.customerEmail, 'Customer email'),
      form.address.trim() ? null : 'Delivery address is required.',
      checkNumberInRange(form.weight, LIMITS.weightKg, 'Weight', ' kg'),
      form.length ? checkNumberInRange(form.length, LIMITS.dimensionCm, 'Length', ' cm') : null,
      form.breadth ? checkNumberInRange(form.breadth, LIMITS.dimensionCm, 'Width', ' cm') : null,
      form.height ? checkNumberInRange(form.height, LIMITS.dimensionCm, 'Height', ' cm') : null,
      // COD collects this amount from the customer, so it cannot be zero.
      form.paymentMethod === 'COD'
        ? checkNumberInRange(form.orderValue, LIMITS.orderValue, 'Order value', '')
        : null,
    ]);

    if (problem) {
      toast.warning('Check the form', problem);
      return;
    }

    setLoading(true);
    try {
      // `/api/rates` uses the lowercase `paymentType` vocabulary, unlike the
      // create-shipment routes which expect title-case `paymentMethod`.
      const isCodOrder = form.paymentMethod === 'COD';
      const data = await api.post(routes.rates, {
        pickupPincode: warehouse.pincode,
        deliveryPincode: form.pincode,
        weight: form.weight,
        length: form.length || '10',
        breadth: form.breadth || '10',
        height: form.height || '10',
        paymentType: isCodOrder ? 'cod' : 'prepaid',
        codAmount: isCodOrder ? form.orderValue || '0' : '0',
        orderValue: form.orderValue || '0',
      });

      if (data.success && Array.isArray(data.data)) {
        setRates(parseRates(data.data));
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

  /**
   * Runs the guards first so a blocked booking never gets a pointless
   * confirmation, then asks before spending wallet balance — booking bills the
   * wallet immediately, and undoing it depends on the courier still accepting
   * a cancellation.
   */
  const handleBookShipment = (rate: RateItem) => {
    if (!auth.currentUser) return;

    // A registered pickup location is mandatory: couriers match
    // `pickupLocationName` against a warehouse registered on their side, and
    // booking without one produces a shipment with an unusable pickup address.
    if (!isWarehouseComplete(warehouse)) {
      toast.error(
        'Pickup Address Required',
        'Add a complete pickup warehouse (name, phone, address, city, state, pincode) before booking.'
      );
      return;
    }

    // An estimated quote has no courier behind it — the server priced it from
    // its local list because that carrier has no credentials, and
    // `/api/shipments/book` refuses it. Stopping here means saying so once,
    // rather than letting the booking fail and inviting the seller to try the
    // next courier, which on a deployment with no credentials is every other
    // row on this screen.
    if (rate.estimated) {
      toast.error(
        'Not Bookable Yet',
        `${formatRate(rate.freight_charge)} for ${rate.carrier_name} is an estimate — that courier is not connected on the server yet, so it cannot be booked. Please contact support.`
      );
      return;
    }

    // A COD shipment is not billed to the wallet, so there is no balance to
    // require. This only mirrors the decision — `/api/shipments/book` is what
    // sets the charge, and it re-derives COD from the payload rather than
    // trusting anything sent from here.
    const isCod = form.paymentMethod === 'COD';

    if (!isCod && (user?.walletBalance || 0) < rate.freight_charge) {
      toast.error(
        'Insufficient Balance',
        `You need ${formatRate(rate.freight_charge)} but have ${formatCurrency(user?.walletBalance || 0)}. Please recharge your wallet.`
      );
      return;
    }

    confirm(
      {
        title: 'Confirm Order',
        message: isCod
          ? `Place this order with ${rate.carrier_name}? Freight is ${formatRate(rate.freight_charge)}, and nothing is deducted from your wallet for a COD shipment.`
          : `Are you sure you want to place this order with ${rate.carrier_name}? ${formatRate(rate.freight_charge)} will be deducted from your wallet, and refunded only if you cancel the order while the courier still allows it.`,
        confirmText: 'Yes, Place Order',
      },
      () => bookShipment(rate)
    );
  };

  /**
   * Hands the whole booking to the payments server, which prices it, debits the
   * wallet, calls the courier and writes the shipment inside one flow it
   * controls. None of that can happen here: a client that can debit its own
   * `walletBalance` can just as easily credit it, so the Firestore rules that
   * would allow this screen to do the bookkeeping are the same rules that let
   * anyone hand themselves free shipping.
   *
   * `freight_charge` still travels, but only so the server can refuse a booking
   * whose displayed price has drifted from the live quote. The amount charged
   * is the server's own.
   */
  const bookShipment = async (rate: RateItem) => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const finalOrderId = form.orderId || generateOrderId();
      // The server derives both `cod_amount` and `total_amount` from
      // `orderValue`, so it must never be zero.
      const orderValue = parseFloat(form.orderValue) || 1;

      const res = await api.post(routes.bookShipment, {
        // Survives a retry: the same attempt must never be charged twice, and a
        // dropped response is exactly when the user taps Book again.
        idempotencyKey: bookingKey(finalOrderId, rate.carrier_id),
        carrierId: rate.carrier_id,
        quotedCharge: rate.freight_charge,
        isReverse: false,

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
        ...warehousePayload(warehouse),
        paymentMethod: form.paymentMethod,
        senderName: user?.businessName || user?.name || 'Shipmatrix',
        orderValue,
        productName: form.productName || 'Products',
      });

      toast.success('Shipment Booked!', `AWB: ${res.awb}`);

      setBookingResult({
        ...res,
        courier: res.courier || rate.carrier_name,
        charge: res.charge,
      });
      setStep('booking');
    } catch (err: any) {
      toast.error('Booking Failed', err?.message || 'Could not book shipment.');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <ScrollView
      className="flex-1 px-5"
      contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      {/* Customer Details */}
      <Text className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-2.5 mt-3">
        Customer Details
      </Text>
      <View
        className="bg-white rounded-2xl p-4 border border-gray-100/90 mb-4 gap-3"

      >
        <InputField label="Name" value={form.customerName} onChangeText={(v) => updateField('customerName', singleSpaced(v))} placeholder="Customer name" icon="user" autoCapitalize="words" maxLength={120} />
        <InputField label="Phone" value={form.customerPhone} onChangeText={(v) => updateField('customerPhone', onlyDigits(v, 10))} placeholder="9876543210" icon="phone" keyboardType="number-pad" maxLength={10} autoComplete="tel" />
        <InputField label="Email" value={form.customerEmail} onChangeText={(v) => updateField('customerEmail', v.trim())} placeholder="customer@email.com" icon="mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={160} />
      </View>

      {/* Delivery Address */}
      <Text className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-2.5">
        Delivery Address
      </Text>
      <View
        className="bg-white rounded-2xl p-4 border border-gray-100/90 mb-4 gap-3"

      >
        <InputField label="Address" value={form.address} onChangeText={(v) => updateField('address', singleSpaced(v))} placeholder="Full address" icon="map-pin" multiline autoCapitalize="words" maxLength={500} />
        <InputField
          label={resolvingCity ? 'Delivery Pincode (looking up…)' : 'Delivery Pincode'}
          value={form.pincode}
          onChangeText={(v) => updateField('pincode', onlyDigits(v, 6))}
          placeholder="110001"
          keyboardType="number-pad"
          maxLength={6}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="City" value={city} onChangeText={(v) => updateField('city', singleSpaced(v))} placeholder="City" autoCapitalize="words" maxLength={80} />
          </View>
          <View className="flex-1">
            <InputField label="State" value={state} onChangeText={(v) => updateField('state', singleSpaced(v))} placeholder="State" autoCapitalize="words" maxLength={80} />
          </View>
        </View>
      </View>

      {/* Pickup Warehouse */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="font-semibold text-[11px] uppercase tracking-wider text-slate-500">
          Pickup Warehouse
        </Text>
        {!isWarehouseComplete(warehouse) && (
          <View className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <Text className="text-[9px] font-black text-amber-700">REQUIRED</Text>
          </View>
        )}
      </View>
      <View className="bg-white rounded-2xl p-4 border border-gray-100/90 mb-4">
        <WarehouseForm
          value={warehouse}
          onChange={setWarehouseEdit}
          onSave={handleSaveWarehouse}
          saving={savingWarehouse}
        />
      </View>

      {/* Package Details */}
      <Text className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-2.5">
        Package Details
      </Text>
      <View
        className="bg-white rounded-2xl p-4 border border-gray-100/90 mb-5 gap-3"

      >
        <InputField label="Product Name" value={form.productName} onChangeText={(v) => updateField('productName', v)} placeholder="Product description" icon="package" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="Weight (kg)" value={form.weight} onChangeText={(v) => updateField('weight', onlyDecimal(v, 4, 3))} placeholder="0.5" keyboardType="decimal-pad" maxLength={8} />
          </View>
          <View className="flex-1">
            <InputField label="Order Value (₹)" value={form.orderValue} onChangeText={(v) => updateField('orderValue', onlyDigits(v, 8))} placeholder="500" keyboardType="number-pad" maxLength={8} />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField label="L (cm)" value={form.length} onChangeText={(v) => updateField('length', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} />
          </View>
          <View className="flex-1">
            <InputField label="W (cm)" value={form.breadth} onChangeText={(v) => updateField('breadth', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} />
          </View>
          <View className="flex-1">
            <InputField label="H (cm)" value={form.height} onChangeText={(v) => updateField('height', onlyDecimal(v, 3, 1))} placeholder="10" keyboardType="decimal-pad" maxLength={5} />
          </View>
        </View>

        {/* Fills L/W/H from two photos of the parcel, right here in the form. */}
        {scanning ? (
          <BoxScanner
            onClose={() => setScanning(false)}
            onMeasured={(size) =>
              setForm((prev) => ({
                ...prev,
                length: size.length,
                breadth: size.width,
                ...(size.height ? { height: size.height } : {}),
              }))
            }
          />
        ) : (
          <View className="flex-row items-center justify-between">
            <Text variant="meta" className="flex-1 pr-3">
              Not sure of the size? Measure it with the camera.
            </Text>
            <ScanButton onPress={() => setScanning(true)} />
          </View>
        )}

        {/* Payment Method */}
        <Text className="text-xs font-semibold text-gray-700 mb-1">Payment Method</Text>
        <View className="flex-row gap-3">
          {(['Prepaid', 'COD'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => updateField('paymentMethod', type)}
              activeOpacity={0.8}
              className={`flex-1 py-3 rounded-xl border items-center ${form.paymentMethod === type ? 'bg-violet-700 border-purple-900' : 'bg-white border-gray-200'
                }`}
              // Shadow lives in `style`, not `className`: NativeWind's interop
              // drops the React Navigation context when a touchable's className
              // is a conditional template literal containing shadow utilities.
              style={
                form.paymentMethod === type
                  ? {
                      shadowColor: '#4C1D95',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text className={`font-semibold text-xs ${form.paymentMethod === type ? 'text-white' : 'text-gray-700'}`}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.paymentMethod === 'COD' && (
          <View className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <Text className="text-[11px] font-sans text-amber-800 leading-4">
              {formatCurrency(parseFloat(form.orderValue) || 0)} will be collected from the customer on delivery,
              based on the order value above.
            </Text>
          </View>
        )}

        <InputField label="Order ID (Optional)" value={form.orderId} onChangeText={(v) => updateField('orderId', v)} placeholder="ORD-12345" />
      </View>

      {/* Get Rates Button */}
      <TouchableOpacity
        onPress={handleGetRates}
        disabled={loading}
        activeOpacity={0.8}
        className={`bg-violet-700 py-4 rounded-full items-center mb-8 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''}`}
        style={{ elevation: 4 }}
      >
        <Text className="text-white font-semibold text-sm">
          {loading ? 'Fetching Rates...' : 'Get Shipping Rates'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRates = () => {
    const cheapestRate = rates.length > 0 ? Math.min(...rates.map((r) => r.freight_charge)) : 0;
    const fastestDays = rates.length > 0 ? Math.min(...rates.map((r) => r.estimated_days || 99)) : 0;
    const parcel = weightBreakdown(form.weight, form.length || 10, form.breadth || 10, form.height || 10);

    return (
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          paddingTop: 12,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Route + parcel summary: what these quotes were priced on. */}
        <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold text-sm text-slate-900">{warehouse.pincode}</Text>
            <Feather name="arrow-right" size={13} color="#94A3B8" />
            <Text className="font-semibold text-sm text-slate-900">{form.pincode}</Text>
          </View>
          <View className="items-end">
            <Text className="font-semibold text-sm text-slate-900">
              {formatWeight(parcel.chargeable)}
            </Text>
            <Text variant="meta" className="text-[11px]">
              {parcel.basis === 'volumetric' ? 'Volumetric weight' : 'Chargeable weight'}
            </Text>
          </View>
        </View>

        {rates
          .slice()
          .sort((a, b) => a.freight_charge - b.freight_charge)
          .map((rate) => (
            <RateCard
              key={rate.carrier_id}
              rate={rate}
              isCheapest={rate.freight_charge === cheapestRate}
              isFastest={rate.estimated_days === fastestDays}
              onPress={() => handleBookShipment(rate)}
              disabled={loading}
            />
          ))}
      </ScrollView>
    );
  };

  const renderBookingSuccess = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="bg-emerald-100 w-20 h-20 rounded-full items-center justify-center mb-6 border border-emerald-200">
        <Feather name="check-circle" size={40} color="#059669" />
      </View>
      <Text className="text-2xl font-bold tracking-tight text-slate-900 mb-2 text-center">
        Shipment Booked!
      </Text>
      <Text className="text-slate-500 text-center mb-2 font-medium text-sm">
        AWB: <Text className="font-semibold text-slate-900" selectable>{bookingResult?.awb || bookingResult?.tracking_id || 'N/A'}</Text>
      </Text>
      <Text className="text-slate-500 text-center mb-1 font-medium text-sm">
        Courier: <Text className="font-semibold text-slate-900">{bookingResult?.courier}</Text>
      </Text>
      <Text className="text-slate-500 text-center mb-6 font-medium text-sm">
        Charge: <Text className="font-semibold text-slate-900">{formatRate(bookingResult?.charge)}</Text>
        {/* The freight is shown either way, but on COD nothing left the wallet
            — saying only "Charge: ₹80" next to an unchanged balance reads as a
            deduction that failed to appear. `walletCharged` is the server's own
            figure, so this cannot drift from what was actually taken. */}
        {bookingResult?.walletCharged === 0 && (
          <Text className="text-emerald-700 font-semibold"> · not deducted (COD)</Text>
        )}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Orders')}
        activeOpacity={0.85}
        className="bg-violet-600 px-8 h-12 justify-center rounded-xl"
      >
        <Text variant="button" className="text-white">Back to Orders</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}
    >
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() =>
              step === 'form'
                ? navigation.goBack()
                : setStep(step === 'rates' ? 'form' : 'rates')
            }
            activeOpacity={0.7}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text variant="title">
              {step === 'form'
                ? 'Create Shipment'
                : step === 'rates'
                  ? 'Choose Courier'
                  : 'Shipment Confirmed'}
            </Text>
            <Text variant="meta" className="mt-0.5">
              {step === 'form'
                ? 'Enter shipment details'
                : step === 'rates'
                  ? `${rates.length} courier options available`
                  : 'Your shipment is ready'}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Stepper */}
      {step !== 'booking' && (
        <View className="flex-row items-center px-5 py-3 bg-white border-b border-slate-100 mb-2">
          {[
            { label: 'Details', active: step === 'form', done: step === 'rates' },
            { label: 'Courier', active: step === 'rates', done: false },
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              <View className="flex-row items-center">
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${item.active || item.done ? 'bg-violet-600' : 'bg-slate-100'
                    }`}
                >
                  {item.done ? (
                    <Feather name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <Text
                      className={`text-[11px] font-bold ${item.active ? 'text-white' : 'text-slate-500'
                        }`}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>

                <Text
                  className={`ml-2 text-[13px] font-semibold ${item.active ? 'text-slate-900' : 'text-slate-500'
                    }`}
                >
                  {item.label}
                </Text>
              </View>

              {index === 0 && (
                <View className="h-[1px] bg-slate-200 flex-1 mx-3" />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      {loading && step !== 'form' ? (
        <LoadingSpinner fullScreen message="Processing..." />
      ) : step === 'form' ? (
        renderForm()
      ) : step === 'rates' ? (
        renderRates()
      ) : (
        renderBookingSuccess()
      )}

      {confirmDialog}
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
  autoCapitalize,
  autoCorrect,
  autoComplete,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  icon?: string;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: any;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-700 mb-1">{label}</Text>
      <View className="relative">
        {icon && (
          <View className="absolute left-3 top-3.5 z-10">
            <Feather name={icon as any} size={16} color="#9ca3af" />
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          maxLength={maxLength}
          multiline={multiline}
          style={{ textAlignVertical: multiline ? 'top' : 'center' }}
          className={`bg-gray-50/90 border border-gray-200 rounded-xl ${icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2.5 text-sm  text-gray-900 ${multiline ? 'min-h-[60px]' : ''}`}
        />
      </View>
    </View>
  );
}
