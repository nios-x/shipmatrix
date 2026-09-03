import React, { useState, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../lib/firebase';
import { api, routes } from '../lib/api';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../lib/useUser';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
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

  useEffect(() => {
    if (route.params) {
      const p = route.params;
      setForm((prev) => ({
        ...prev,
        pincode: p.deliveryPincode || prev.pincode,
        weight: p.weight ? String(p.weight) : prev.weight,
        length: p.length ? String(p.length) : prev.length,
        breadth: (p.breadth || p.width) ? String(p.breadth || p.width) : prev.breadth,
        height: p.height ? String(p.height) : prev.height,
        orderId: p.orderId || prev.orderId,
      }));
    }
  }, [route.params]);

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
        `₹${rate.freight_charge} for ${rate.carrier_name} is an estimate — that courier is not connected on the server yet, so it cannot be booked. Please contact support.`
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
        `You need ₹${rate.freight_charge} but have ₹${(user?.walletBalance || 0).toFixed(2)}. Please recharge your wallet.`
      );
      return;
    }

    confirm(
      {
        title: 'Confirm Order',
        message: isCod
          ? `Place this order with ${rate.carrier_name}? Freight is ₹${rate.freight_charge}, and nothing is deducted from your wallet for a COD shipment.`
          : `Are you sure you want to place this order with ${rate.carrier_name}? ₹${rate.freight_charge} will be deducted from your wallet, and refunded only if you cancel the order while the courier still allows it.`,
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
      <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider mb-2.5 mt-3">
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
      <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider mb-2.5">
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
        <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider">
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
      <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider mb-2.5">
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

        {/* Fills L/W/H from a photo of the parcel. `returnTo` tells the sizer
            to come back to this form rather than pushing a second copy. */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ParcelSizer', { returnTo: 'CreateShipment' })}
          activeOpacity={0.75}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/70 py-2.5"
        >
          <Feather name="camera" size={14} color="#7C3AED" />
          <Text className="text-[11px] font-raleway-bold text-violet-700">
            Measure dimensions with camera
          </Text>
        </TouchableOpacity>

        {/* Payment Method */}
        <Text className="text-xs font-raleway-bold text-gray-700 mb-1">Payment Method</Text>
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
              <Text className={`font-raleway-bold text-xs ${form.paymentMethod === type ? 'text-white' : 'text-gray-700'}`}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.paymentMethod === 'COD' && (
          <View className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <Text className="text-[11px] font-raleway text-amber-800 leading-4">
              ₹{parseFloat(form.orderValue) || 0} will be collected from the customer on delivery,
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
        <Text className="text-white font-raleway-bold text-sm">
          {loading ? 'Fetching Rates...' : 'Get Shipping Rates'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRates = () => {
    const cheapestRate = rates.length > 0 ? Math.min(...rates.map((r) => r.freight_charge)) : 0;
    const fastestDays = rates.length > 0 ? Math.min(...rates.map((r) => r.estimated_days || 99)) : 0;

    return (
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Summary Pill */}
        <View className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs mb-3.5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1">
              <Feather name="map-pin" size={12} color="#10B981" />
              <Text className="text-xs font-black text-slate-800">
                {warehouse.pincode}
              </Text>
            </View>
            <Feather name="arrow-right" size={12} color="#94A3B8" />
            <View className="flex-row items-center gap-1">
              <Feather name="map-pin" size={12} color="#0284C7" />
              <Text className="text-xs font-black text-slate-800">
                {form.pincode}
              </Text>
            </View>
          </View>
          <View className="bg-slate-100 px-2.5 py-1 rounded-lg">
            <Text className="text-[11px] font-bold text-slate-700">
              {form.weight} kg
            </Text>
          </View>
        </View>

        {rates
          .slice()
          .sort((a, b) => a.freight_charge - b.freight_charge)
          .map((rate) => {
            const isAir = rate.carrier_name.toLowerCase().includes('air');
            const isCheapest = rate.freight_charge === cheapestRate;
            const isFastest = rate.estimated_days === fastestDays;

            return (
              <View
                key={rate.carrier_id}
                className="bg-white rounded-3xl p-5 mb-3.5 border border-slate-100 shadow-xs"
              >
                {/* Top Badges */}
                <View className="flex-row items-center justify-between mb-3.5">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 ${isAir
                        ? 'bg-sky-50 border border-sky-100'
                        : 'bg-slate-100 border border-slate-200'
                        }`}
                    >
                      <Feather
                        name={isAir ? 'send' : 'truck'}
                        size={11}
                        color={isAir ? '#0284C7' : '#475569'}
                      />
                      <Text
                        className={`text-[10px] font-bold ${isAir ? 'text-sky-700' : 'text-slate-700'
                          }`}
                      >
                        {isAir ? 'Air Express' : 'Surface Logistics'}
                      </Text>
                    </View>

                    {isCheapest && (
                      <View className="bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <Text className="text-[9px] font-black text-emerald-700">
                          ★ CHEAPEST
                        </Text>
                      </View>
                    )}

                    {isFastest && !isCheapest && (
                      <View className="bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                        <Text className="text-[9px] font-black text-violet-700">
                          ⚡ FASTEST
                        </Text>
                      </View>
                    )}

                    {/* Priced from the local list, with no courier account
                        behind it. Marked on the card as well as blocked on tap:
                        finding out only after choosing a courier, filling a
                        form and pressing Ship Now is what made this read as a
                        courier outage rather than a deployment that has no
                        courier connected. */}
                    {rate.estimated && (
                      <View className="bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Text className="text-[9px] font-black text-amber-700">
                          ESTIMATE
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <Feather name="shield" size={10} color="#10B981" />
                    <Text className="text-[9px] font-bold text-emerald-700">Insured</Text>
                  </View>
                </View>

                {/* Main Courier Info */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className="w-13 h-13 rounded-2xl bg-slate-50 items-center justify-center p-1.5 border border-slate-100">
                      <CourierLogo name={rate.carrier_name} />
                    </View>

                    <View className="ml-3.5 flex-1">
                      <Text
                        className="text-sm font-black text-slate-900 tracking-tight"
                        numberOfLines={1}
                      >
                        {rate.carrier_name}
                      </Text>

                      <View className="flex-row items-center mt-1.5">
                        <Feather name="clock" size={12} color="#64748B" />
                        <Text className="text-xs text-slate-500 font-semibold ml-1.5">
                          Est. {rate.estimated_days || 3} business days
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-[9px] font-black text-slate-400 tracking-wider">
                      ALL-INCLUSIVE
                    </Text>
                    <Text className="text-2xl font-black text-slate-950 mt-0.5">
                      ₹{rate.freight_charge}
                    </Text>
                  </View>
                </View>

                {/* Footer CTA */}
                <View className="mt-4 pt-3.5 border-t border-slate-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="check" size={13} color="#10B981" />
                    <Text className="text-[11px] font-medium text-slate-500">
                      Free doorstep pickup included
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleBookShipment(rate)}
                    disabled={loading}
                    activeOpacity={0.8}
                    className="bg-violet-600 px-4 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm shadow-violet-500/20"
                  >
                    <Text className="text-xs font-black text-white">Ship Now</Text>
                    <Feather name="arrow-right" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
      </ScrollView>
    );
  };

  const renderBookingSuccess = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View className="bg-emerald-100 w-20 h-20 rounded-full items-center justify-center mb-6 border border-emerald-200">
        <Feather name="check-circle" size={40} color="#059669" />
      </View>
      <Text className="text-2xl font-black text-slate-900 mb-2 text-center">
        Shipment Booked!
      </Text>
      <Text className="text-slate-500 text-center mb-2 font-medium text-sm">
        AWB: <Text className="font-mono font-bold text-slate-800">{bookingResult?.awb || bookingResult?.tracking_id || 'N/A'}</Text>
      </Text>
      <Text className="text-slate-500 text-center mb-1 font-medium text-sm">
        Courier: <Text className="font-bold text-slate-800">{bookingResult?.courier}</Text>
      </Text>
      <Text className="text-slate-500 text-center mb-6 font-medium text-sm">
        Charge: <Text className="font-bold text-slate-800">₹{bookingResult?.charge}</Text>
        {/* The freight is shown either way, but on COD nothing left the wallet
            — saying only "Charge: ₹80" next to an unchanged balance reads as a
            deduction that failed to appear. `walletCharged` is the server's own
            figure, so this cannot drift from what was actually taken. */}
        {bookingResult?.walletCharged === 0 && (
          <Text className="text-emerald-600 font-bold"> · not deducted (COD)</Text>
        )}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Orders')}
        activeOpacity={0.8}
        className="bg-violet-600 px-8 py-3.5 rounded-xl shadow-sm shadow-violet-500/20"
      >
        <Text className="text-white font-black text-sm">Back to Orders</Text>
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
            <Text className="text-xl font-black text-slate-900 tracking-tight">
              {step === 'form'
                ? 'Create Shipment'
                : step === 'rates'
                  ? 'Choose Courier'
                  : 'Shipment Confirmed'}
            </Text>
            <Text className="text-xs text-slate-500 font-medium mt-0.5">
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
                      className={`text-[10px] font-black ${item.active ? 'text-white' : 'text-slate-500'
                        }`}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>

                <Text
                  className={`ml-2 text-xs font-bold ${item.active ? 'text-slate-900' : 'text-slate-400'
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
      <Text className="text-xs font-raleway-bold text-gray-700 mb-1">{label}</Text>
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
          className={`bg-gray-50/90 border border-gray-200 rounded-xl ${icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2.5 text-sm font-raleway text-gray-900 ${multiline ? 'min-h-[60px]' : ''}`}
        />
      </View>
    </View>
  );
}
