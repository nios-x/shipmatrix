import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatCurrency } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api, ApiError, routes } from '../lib/api';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type RouteMode = 'surface' | 'air';
type BookingMode = 'credit' | 'topay';

/**
 * Off until there's a real rate card and a wallet debit for this product.
 *
 * The form below never showed a price or checked a balance before booking,
 * and the server route it calls had no auth in front of it either — every
 * booking through here was a real, free XpressBees cargo manifest. The server
 * side is closed now (`/api/v1/xpressbees/b2b-cargo` refuses every request),
 * so this flag is UI-only: it stops sellers from filling out a form that can
 * only ever fail, rather than leaving the fact that it's disabled to a
 * generic error after they've typed in two addresses.
 */
const B2B_CARGO_ENABLED = false;

export default function B2bCargoScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { confirm, confirmDialog } = useConfirm();

  const [loading, setLoading] = useState(false);
  const [manifestResult, setManifestResult] = useState<any>(null);

  // 1. Shipping Details
  const [routeMode, setRouteMode] = useState<RouteMode>('surface');
  const [bookingMode, setBookingMode] = useState<BookingMode>('credit');
  const [invoiceValue, setInvoiceValue] = useState('');

  // 2. Shipper Details
  const [shipperName, setShipperName] = useState('');
  const [shipperPhone, setShipperPhone] = useState('');
  const [shipperAddress, setShipperAddress] = useState('');
  const [shipperCity, setShipperCity] = useState('');
  const [shipperState, setShipperState] = useState('');
  const [shipperPincode, setShipperPincode] = useState('');

  // 3. Consignee Details
  const [consigneeName, setConsigneeName] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [consigneeCity, setConsigneeCity] = useState('');
  const [consigneeState, setConsigneeState] = useState('');
  const [consigneePincode, setConsigneePincode] = useState('');

  // 4. Package Dimensions
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [breadth, setBreadth] = useState('');
  const [height, setHeight] = useState('');
  const [mpsCount, setMpsCount] = useState('1');

  const handleCreateManifest = () => {
    // Validations
    if (!invoiceValue || parseFloat(invoiceValue) <= 0) {
      toast.warning('Missing Invoice Value', 'Please enter invoice value (₹).');
      return;
    }
    if (!shipperName || !shipperPhone || !shipperAddress || !shipperPincode) {
      toast.warning(
        'Missing Shipper Details',
        'Please complete shipper details including pincode.'
      );
      return;
    }
    if (!consigneeName || !consigneePhone || !consigneeAddress || !consigneePincode) {
      toast.warning(
        'Missing Consignee Details',
        'Please complete consignee details including pincode.'
      );
      return;
    }
    if (!weight || parseFloat(weight) <= 0) {
      toast.warning('Missing Weight', 'Please enter total package weight in KG.');
      return;
    }

    confirm(
      {
        title: 'Confirm Cargo Booking',
        message: `Are you sure you want to book this ${routeMode === 'air' ? 'air' : 'surface'} cargo manifest for ${consigneeName} (${formatCurrency(Number(invoiceValue) || 0)} invoice value)? A manifest cannot be edited once generated.`,
        confirmText: 'Yes, Book Cargo',
      },
      () => createManifest()
    );
  };

  const createManifest = async () => {
    setLoading(true);
    setManifestResult(null);

    const payload = {
      routeMode: routeMode === 'air' ? 'Air Cargo (7167...)' : 'Surface Cargo (9169...)',
      bookingMode: bookingMode.toUpperCase(),
      invoiceValue: parseFloat(invoiceValue),
      shipper: {
        name: shipperName,
        phone: shipperPhone,
        address: shipperAddress,
        city: shipperCity,
        state: shipperState,
        pincode: shipperPincode,
      },
      consignee: {
        name: consigneeName,
        phone: consigneePhone,
        address: consigneeAddress,
        city: consigneeCity,
        state: consigneeState,
        pincode: consigneePincode,
      },
      package: {
        weight: parseFloat(weight),
        length: length || '10',
        breadth: breadth || '10',
        height: height || '10',
        mpsCount: parseInt(mpsCount, 10) || 1,
      },
      pickupPincode: shipperPincode,
      deliveryPincode: consigneePincode,
    };

    try {
      const res = await api.post(routes.b2bCargo, payload);

      if (res && res.success && (res.awb || res.parent_awb)) {
        setManifestResult({
          awb: res.awb || res.parent_awb,
          routeMode: payload.routeMode,
          bookingMode: payload.bookingMode,
          mpsCount: payload.package.mpsCount,
          weight: payload.package.weight,
        });
        toast.success(
          'B2B Cargo Created!',
          `Manifest created with AWB: ${res.awb || res.parent_awb}`
        );
      } else {
        toast.error(
          'Manifest Not Created',
          res?.ReturnMessage ||
            res?.message ||
            'The courier did not confirm this booking. Nothing was charged.'
        );
      }
    } catch (err: any) {
      toast.error(
        'Manifest Not Created',
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRouteMode('surface');
    setBookingMode('credit');
    setInvoiceValue('');
    setShipperName('');
    setShipperPhone('');
    setShipperAddress('');
    setShipperCity('');
    setShipperState('');
    setShipperPincode('');
    setConsigneeName('');
    setConsigneePhone('');
    setConsigneeAddress('');
    setConsigneeCity('');
    setConsigneeState('');
    setConsigneePincode('');
    setWeight('');
    setLength('');
    setBreadth('');
    setHeight('');
    setMpsCount('1');
    setManifestResult(null);
  };

  if (!B2B_CARGO_ENABLED) {
    return (
      <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>
          <Text className="font-black text-xl tracking-tight text-slate-900">
            B2B Cargo Shipping
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50">
            <Feather name="package" size={26} color="#7C3AED" />
          </View>
          <Text className="mb-1.5 text-center font-black text-base text-slate-900">
            B2B Cargo is not live yet
          </Text>
          <Text className="text-center text-sm leading-5 text-slate-500">
            Bulk cargo shipping is being finalized. Contact support to enable it for your account.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="font-black text-xl tracking-tight text-slate-900">
              B2B Cargo Shipping
            </Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-500">
              Create a bulk/cargo shipment via XpressBees
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.7}
          className="h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
          <Feather name="rotate-ccw" size={16} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Manifest Result Success Box */}
        {manifestResult && (
          <View className="shadow-xs mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <View className="mb-3 flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Feather name="check-circle" size={18} color="#059669" />
              </View>
              <Text className="font-black text-base text-emerald-950">
                B2B Cargo Manifest Created
              </Text>
            </View>

            <View className="gap-2 rounded-2xl border border-emerald-100 bg-white p-4">
              <View className="flex-row justify-between">
                <Text className="font-bold text-xs text-slate-500">Parent AWB</Text>
                <Text className="font-black font-mono text-xs text-emerald-700">
                  {manifestResult.awb}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-bold text-xs text-slate-500">Route Mode</Text>
                <Text className="font-bold text-xs text-slate-800">{manifestResult.routeMode}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-bold text-xs text-slate-500">Booking Mode</Text>
                <Text className="font-bold text-xs text-slate-800">
                  {manifestResult.bookingMode}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-bold text-xs text-slate-500">MPS Boxes</Text>
                <Text className="font-bold text-xs text-slate-800">
                  {manifestResult.mpsCount} box(es)
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── 1. Shipping Details ─── */}
        <Text className="mb-2.5 font-black text-xs uppercase tracking-wider text-slate-400">
          Shipping Details
        </Text>
        <View className="shadow-xs mb-5 gap-4 rounded-3xl border border-slate-100 bg-white p-5">
          {/* Route Mode */}
          <View>
            <Text className="mb-1.5 font-bold text-[11px] text-slate-700">Route Mode</Text>
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setRouteMode('surface')}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center gap-2 rounded-xl border px-3 py-3 ${
                  routeMode === 'surface'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-slate-200 bg-slate-50'
                }`}>
                <Feather
                  name="truck"
                  size={15}
                  color={routeMode === 'surface' ? '#7C3AED' : '#64748B'}
                />
                <View className="flex-1">
                  <Text
                    className={`font-bold text-xs ${
                      routeMode === 'surface' ? 'text-violet-900' : 'text-slate-700'
                    }`}>
                    Surface Cargo
                  </Text>
                  <Text className="font-mono text-[10px] text-slate-400">(9169...)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRouteMode('air')}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center gap-2 rounded-xl border px-3 py-3 ${
                  routeMode === 'air'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-slate-200 bg-slate-50'
                }`}>
                <Feather
                  name="send"
                  size={15}
                  color={routeMode === 'air' ? '#7C3AED' : '#64748B'}
                />
                <View className="flex-1">
                  <Text
                    className={`font-bold text-xs ${
                      routeMode === 'air' ? 'text-violet-900' : 'text-slate-700'
                    }`}>
                    Air Cargo
                  </Text>
                  <Text className="font-mono text-[10px] text-slate-400">(7167...)</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Booking Mode */}
          <View>
            <Text className="mb-1.5 font-bold text-[11px] text-slate-700">Booking Mode</Text>
            <View className="flex-row gap-2.5">
              {(['credit', 'topay'] as const).map((bm) => {
                const isSelected = bookingMode === bm;
                return (
                  <TouchableOpacity
                    key={bm}
                    onPress={() => setBookingMode(bm)}
                    activeOpacity={0.8}
                    className={`flex-1 items-center justify-center rounded-xl border py-2.5 ${
                      isSelected
                        ? 'border-violet-600 bg-violet-600 shadow-sm shadow-violet-500/20'
                        : 'border-slate-200 bg-slate-50'
                    }`}>
                    <Text
                      className={`font-bold text-xs ${
                        isSelected ? 'text-white' : 'text-slate-700'
                      }`}>
                      {bm === 'credit' ? 'Credit' : 'ToPay'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Invoice Value */}
          <View>
            <Text className="mb-1.5 font-bold text-[11px] text-slate-700">Invoice Value (₹)</Text>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus:border-violet-500">
              <Text className="mr-1.5 font-bold text-xs text-slate-500">₹</Text>
              <TextInput
                value={invoiceValue}
                onChangeText={setInvoiceValue}
                placeholder="e.g. 5000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                className="flex-1 py-2.5 font-bold text-xs text-slate-900"
              />
            </View>
          </View>
        </View>

        {/* ─── 2. Shipper Details ─── */}
        <Text className="mb-2.5 font-black text-xs uppercase tracking-wider text-slate-400">
          Shipper Details
        </Text>
        <View className="shadow-xs mb-5 gap-3.5 rounded-3xl border border-slate-100 bg-white p-5">
          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Company/Sender Name</Text>
            <TextInput
              value={shipperName}
              onChangeText={setShipperName}
              placeholder="e.g. Acme Industrial Ltd"
              placeholderTextColor="#94A3B8"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Phone Number</Text>
            <TextInput
              value={shipperPhone}
              onChangeText={setShipperPhone}
              placeholder="9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Address</Text>
            <TextInput
              value={shipperAddress}
              onChangeText={setShipperAddress}
              placeholder="Warehouse / Factory Address"
              placeholderTextColor="#94A3B8"
              multiline
              className="min-h-[50px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">City</Text>
              <TextInput
                value={shipperCity}
                onChangeText={setShipperCity}
                placeholder="Mumbai"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">State</Text>
              <TextInput
                value={shipperState}
                onChangeText={setShipperState}
                placeholder="Maharashtra"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
              />
            </View>
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Pincode (6 digits)</Text>
            <TextInput
              value={shipperPincode}
              onChangeText={setShipperPincode}
              placeholder="400001"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={6}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-xs text-slate-900"
            />
          </View>
        </View>

        {/* ─── 3. Consignee Details ─── */}
        <Text className="mb-2.5 font-black text-xs uppercase tracking-wider text-slate-400">
          Consignee Details
        </Text>
        <View className="shadow-xs mb-5 gap-3.5 rounded-3xl border border-slate-100 bg-white p-5">
          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Company/Receiver Name</Text>
            <TextInput
              value={consigneeName}
              onChangeText={setConsigneeName}
              placeholder="e.g. Horizon Enterprises"
              placeholderTextColor="#94A3B8"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Phone Number</Text>
            <TextInput
              value={consigneePhone}
              onChangeText={setConsigneePhone}
              placeholder="9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Address</Text>
            <TextInput
              value={consigneeAddress}
              onChangeText={setConsigneeAddress}
              placeholder="Delivery Facility / Warehouse Address"
              placeholderTextColor="#94A3B8"
              multiline
              className="min-h-[50px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">City</Text>
              <TextInput
                value={consigneeCity}
                onChangeText={setConsigneeCity}
                placeholder="New Delhi"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
              />
            </View>
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">State</Text>
              <TextInput
                value={consigneeState}
                onChangeText={setConsigneeState}
                placeholder="Delhi"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-xs text-slate-900"
              />
            </View>
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Pincode (6 digits)</Text>
            <TextInput
              value={consigneePincode}
              onChangeText={setConsigneePincode}
              placeholder="110001"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={6}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-xs text-slate-900"
            />
          </View>
        </View>

        {/* ─── 4. Package Dimensions ─── */}
        <Text className="mb-2.5 font-black text-xs uppercase tracking-wider text-slate-400">
          Package Dimensions
        </Text>
        <View className="shadow-xs mb-6 gap-3.5 rounded-3xl border border-slate-100 bg-white p-5">
          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">Total Weight (KG)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 50"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-xs text-slate-900"
            />
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">Length (CM)</Text>
              <TextInput
                value={length}
                onChangeText={setLength}
                placeholder="10"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-bold text-xs text-slate-900"
              />
            </View>

            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">Breadth (CM)</Text>
              <TextInput
                value={breadth}
                onChangeText={setBreadth}
                placeholder="10"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-bold text-xs text-slate-900"
              />
            </View>

            <View className="flex-1">
              <Text className="mb-1 font-bold text-[11px] text-slate-700">Height (CM)</Text>
              <TextInput
                value={height}
                onChangeText={setHeight}
                placeholder="10"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-bold text-xs text-slate-900"
              />
            </View>
          </View>

          <View>
            <Text className="mb-1 font-bold text-[11px] text-slate-700">MPS Count (Boxes)</Text>
            <TextInput
              value={mpsCount}
              onChangeText={setMpsCount}
              placeholder="1"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-xs text-slate-900"
            />
          </View>
        </View>

        {/* ─── 5. Action Button ─── */}
        <TouchableOpacity
          onPress={handleCreateManifest}
          disabled={loading}
          activeOpacity={0.8}
          className={`mb-6 flex-row items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 shadow-md shadow-violet-500/25 ${
            loading ? 'opacity-70' : ''
          }`}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text className="font-black text-sm text-white">Create B2B Cargo Manifest</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        {/* ─── 6. XpressBees API Integration Info Box ─── */}
        <View className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <View className="mb-2 flex-row items-center gap-2">
            <Feather name="zap" size={16} color="#A78BFA" />
            <Text className="font-black text-xs uppercase tracking-wider text-white">
              XpressBees API Integration
            </Text>
          </View>

          <Text className="mb-3 font-medium text-xs leading-5 text-slate-400">
            This form integrates directly with the XpressBees POSTShipmentService
            AddCargoManifestDetails API endpoint.
          </Text>

          <View className="gap-2 border-t border-slate-800 pt-3">
            <View className="flex-row items-start gap-2">
              <Text className="text-xs text-violet-400">•</Text>
              <Text className="flex-1 text-xs leading-4 text-slate-300">
                Automatic Parent AWB allocation based on mode (Air: 7167..., Surface: 9169...)
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text className="text-xs text-violet-400">•</Text>
              <Text className="flex-1 text-xs leading-4 text-slate-300">
                MPS (Multi-Piece Shipment) support up to 10 boxes
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text className="text-xs text-violet-400">•</Text>
              <Text className="flex-1 text-xs leading-4 text-slate-300">
                Credit and ToPay booking modes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {confirmDialog}
    </KeyboardAvoidingView>
  );
}
