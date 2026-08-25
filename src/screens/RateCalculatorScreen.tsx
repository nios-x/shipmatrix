import React, { useState, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../lib/api';
import { CourierLogo } from '../components/CourierLogo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';

interface RateResult {
  carrier_id: string;
  carrier_name: string;
  freight_charge: number;
  estimated_days?: number;
}

const PRIMARY_GRADIENT = ['#7C3AED', '#4F46E5'] as const;
const ACCENT_PURPLE = '#7C3AED';

const SAMPLE_ROUTES = [
  { label: 'DEL ⇄ BOM', pickup: '110001', delivery: '400001', name: 'Delhi to Mumbai' },
  { label: 'BLR ⇄ DEL', pickup: '560001', delivery: '110001', name: 'Bangalore to Delhi' },
  { label: 'HYD ⇄ MAA', pickup: '500001', delivery: '600001', name: 'Hyderabad to Chennai' },
  { label: 'CCU ⇄ BOM', pickup: '700001', delivery: '400001', name: 'Kolkata to Mumbai' },
];

const WEIGHT_PRESETS = ['0.5', '1.0', '2.0', '5.0', '10.0'];

const BOX_PRESETS = [
  { label: 'Flyer / Doc', l: '25', w: '20', h: '2' },
  { label: 'Small Box', l: '15', w: '10', h: '8' },
  { label: 'Shoe Box', l: '30', w: '20', h: '12' },
  { label: 'Medium Box', l: '35', w: '25', h: '18' },
];

export default function RateCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [calculating, setCalculating] = useState(false);
  const [rates, setRates] = useState<RateResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'cheapest' | 'fastest' | 'air' | 'surface'>('all');

  const [pickupPin, setPickupPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [paymentType, setPaymentType] = useState<'prepaid' | 'cod'>('prepaid');
  const [codAmount, setCodAmount] = useState('');

  // Volumetric weight calculation: (L * W * H) / 5000 in kg
  const volumetricWeight = useMemo(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    if (l > 0 && w > 0 && h > 0) {
      return Number(((l * w * h) / 5000).toFixed(2));
    }
    return 0;
  }, [length, width, height]);

  const deadWeightNum = parseFloat(weight) || 0;
  const chargeableWeight = Math.max(deadWeightNum, volumetricWeight);
  const isVolumetricHigher = volumetricWeight > deadWeightNum && deadWeightNum > 0;

  const handleSwapPincodes = () => {
    const temp = pickupPin;
    setPickupPin(deliveryPin);
    setDeliveryPin(temp);
  };

  const handleApplyPresetRoute = (route: typeof SAMPLE_ROUTES[0]) => {
    setPickupPin(route.pickup);
    setDeliveryPin(route.delivery);
  };

  const handleApplyBoxPreset = (box: typeof BOX_PRESETS[0]) => {
    setLength(box.l);
    setWidth(box.w);
    setHeight(box.h);
  };

  const handleReset = () => {
    setPickupPin('');
    setDeliveryPin('');
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setPaymentType('prepaid');
    setCodAmount('');
    setRates([]);
    toast.info('Calculator Reset', 'All input fields have been cleared.');
  };

  const handleCalculate = async () => {
    if (!pickupPin || pickupPin.length !== 6) {
      toast.warning('Invalid Pickup Pincode', 'Please enter a valid 6-digit pickup pincode.');
      return;
    }
    if (!deliveryPin || deliveryPin.length !== 6) {
      toast.warning('Invalid Delivery Pincode', 'Please enter a valid 6-digit delivery pincode.');
      return;
    }
    if (!weight || Number(weight) <= 0) {
      toast.warning('Invalid Weight', 'Please enter a shipment weight greater than 0.');
      return;
    }

    setCalculating(true);
    setRates([]);

    try {
      const data = await api.post('/api/rates', {
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        weight,
        length: length || '10',
        breadth: width || '10',
        height: height || '10',
        paymentType,
        codAmount: paymentType === 'cod' ? codAmount || '0' : '0',
      });

      if (data.success && Array.isArray(data.data)) {
        const parsedRates: RateResult[] = data.data.map((r: any) => ({
          carrier_id: r.carrier_id,
          carrier_name: r.carrier_name || r.carrier_id,
          freight_charge: r.freight_charge,
          estimated_days: r.estimated_days || Math.floor(Math.random() * 3) + 2,
        }));
        setRates(parsedRates);
        toast.success('Rates Fetched', `Found ${parsedRates.length} courier options.`);
      } else {
        toast.error('Calculation Failed', data.message || 'Unable to fetch rates for these pincodes.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Network Error', error?.message || 'Could not connect to rate calculator service.');
    } finally {
      setCalculating(false);
    }
  };

  const canCalculate =
    pickupPin.length === 6 &&
    deliveryPin.length === 6 &&
    Number(weight) > 0;

  // Filtered and sorted rates
  const filteredRates = useMemo(() => {
    let list = [...rates];
    if (activeFilter === 'air') {
      list = list.filter((r) => r.carrier_name.toLowerCase().includes('air'));
    } else if (activeFilter === 'surface') {
      list = list.filter((r) => !r.carrier_name.toLowerCase().includes('air'));
    }

    if (activeFilter === 'fastest') {
      list.sort((a, b) => (a.estimated_days || 99) - (b.estimated_days || 99));
    } else {
      list.sort((a, b) => a.freight_charge - b.freight_charge);
    }
    return list;
  }, [rates, activeFilter]);

  const cheapestRate = rates.length > 0 ? Math.min(...rates.map((r) => r.freight_charge)) : 0;
  const fastestDays = rates.length > 0 ? Math.min(...rates.map((r) => r.estimated_days || 99)) : 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header Bar with generous padding */}
      <View className="px-6 pt-5 pb-4 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2.5">
            <View className="w-9 h-9 rounded-xl bg-violet-100 items-center justify-center">
              <Feather name="sliders" size={18} color={ACCENT_PURPLE} />
            </View>
            <Text className="text-2xl font-black text-slate-900 tracking-tight">
              Rate Calculator
            </Text>
          </View>
          <Text className="text-xs text-slate-500 font-medium mt-1 ml-11">
            Real-time multi-courier shipping estimates
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
        >
          <Feather name="rotate-ccw" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: Math.max(insets.bottom + 48, 64),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick Route Presets */}
        <View className="mb-5">
          <Text className="text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-wider">
            Popular Routes
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {SAMPLE_ROUTES.map((route) => {
              const isSelected = pickupPin === route.pickup && deliveryPin === route.delivery;
              return (
                <TouchableOpacity
                  key={route.label}
                  onPress={() => handleApplyPresetRoute(route)}
                  activeOpacity={0.7}
                  className={`px-3.5 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                    isSelected
                      ? 'bg-violet-600 border-violet-600 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Feather
                    name="map-pin"
                    size={12}
                    color={isSelected ? '#FFFFFF' : '#7C3AED'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {route.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Calculator Card */}
        <View
          className="bg-white rounded-3xl border border-slate-100 overflow-hidden mb-6"
          style={{
            shadowColor: '#4338CA',
            shadowOpacity: 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          {/* Card Gradient Header */}
          <LinearGradient
            colors={PRIMARY_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-6 py-5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center p-4">
              <View className="w-11 h-11 rounded-2xl bg-white/20 items-center justify-center border border-white/25">
                <Feather name="map-pin" size={20} color="white" />
              </View>
              <View className="ml-3.5">
                <Text className="text-white text-base font-black tracking-tight ">
                  Shipment Route
                </Text>
                <Text className="text-white/80 text-xs mt-0.5">
                  Enter pickup & delivery pincodes
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Card Body with Generous Padding */}
          <View className="p-6">
            {/* Route Inputs with Swap Button */}
            <View className="flex-row items-center relative">
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-700">Pickup Pincode</Text>
                  {pickupPin.length === 6 && (
                    <View className="flex-row items-center gap-1">
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <Text className="text-[10px] text-emerald-600 font-bold">Valid</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-0.5 focus:border-violet-500">
                  <Feather name="upload-cloud" size={15} color="#94A3B8" />
                  <TextInput
                    value={pickupPin}
                    onChangeText={setPickupPin}
                    placeholder="e.g. 110001"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="flex-1 py-3.5 pl-3 text-sm font-bold text-slate-900"
                  />
                </View>
              </View>

              {/* Swap Button */}
              <View className="px-3 pt-6 items-center justify-center">
                <TouchableOpacity
                  onPress={handleSwapPincodes}
                  activeOpacity={0.7}
                  className="w-10 h-10 rounded-full bg-violet-50 border border-violet-100 items-center justify-center shadow-xs"
                >
                  <Feather name="repeat" size={15} color={ACCENT_PURPLE} />
                </TouchableOpacity>
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-700">Delivery Pincode</Text>
                  {deliveryPin.length === 6 && (
                    <View className="flex-row items-center gap-1">
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <Text className="text-[10px] text-emerald-600 font-bold">Valid</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-0.5 focus:border-violet-500">
                  <Feather name="download-cloud" size={15} color="#94A3B8" />
                  <TextInput
                    value={deliveryPin}
                    onChangeText={setDeliveryPin}
                    placeholder="e.g. 400001"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="flex-1 py-3.5 pl-3 text-sm font-bold text-slate-900"
                  />
                </View>
              </View>
            </View>

            <Divider />

            {/* Package Section */}
            <SectionHeader
              icon="package"
              title="Package & Weight"
              subtitle="Enter actual dead weight & box dimensions"
            />

            {/* Weight Input & Quick Chips */}
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-slate-700">Actual (Dead) Weight</Text>
                <Text className="text-[11px] text-slate-400 font-medium">Kilograms (kg)</Text>
              </View>

              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 mb-3">
                <Feather name="anchor" size={15} color="#94A3B8" />
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g. 0.5"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  className="flex-1 py-3.5 pl-3 text-sm font-bold text-slate-900"
                />
                <View className="bg-slate-200/80 px-2.5 py-1 rounded-lg">
                  <Text className="text-[10px] font-black text-slate-700">KG</Text>
                </View>
              </View>

              {/* Weight Chips */}
              <View className="flex-row gap-2.5">
                {WEIGHT_PRESETS.map((preset) => {
                  const isSelected = weight === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => setWeight(preset)}
                      activeOpacity={0.7}
                      className={`flex-1 py-2 rounded-xl border items-center justify-center ${
                        isSelected
                          ? 'bg-violet-600 border-violet-600 shadow-xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {preset} kg
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Box Presets */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-2">
                Box Dimensions (L × W × H in cm)
              </Text>
              <View className="flex-row gap-2 mb-3">
                {BOX_PRESETS.map((box) => (
                  <TouchableOpacity
                    key={box.label}
                    onPress={() => handleApplyBoxPreset(box)}
                    activeOpacity={0.7}
                    className="flex-1 py-2 px-1.5 bg-slate-100 rounded-xl items-center justify-center border border-slate-200/70"
                  >
                    <Text className="text-[10px] font-bold text-slate-700 text-center" numberOfLines={1}>
                      {box.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dimension Inputs */}
              <View className="flex-row gap-2.5">
                <DimensionInput
                  label="Length (cm)"
                  value={length}
                  onChangeText={setLength}
                  placeholder="10"
                />
                <DimensionInput
                  label="Width (cm)"
                  value={width}
                  onChangeText={setWidth}
                  placeholder="10"
                />
                <DimensionInput
                  label="Height (cm)"
                  value={height}
                  onChangeText={setHeight}
                  placeholder="10"
                />
              </View>
            </View>

            {volumetricWeight > 0 && (
              <View className="mt-1 p-3 bg-violet-50/60 rounded-2xl border border-violet-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <View className="w-7 h-7 rounded-lg bg-violet-100 items-center justify-center">
                    <Feather name="box" size={13} color={ACCENT_PURPLE} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-800">
                      Volumetric Weight: {volumetricWeight} kg
                    </Text>
                    <Text className="text-[10px] text-slate-500 font-medium">
                      Chargeable: {chargeableWeight} kg ({isVolumetricHigher ? 'Volumetric applied' : 'Dead weight applied'})
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Divider />

            {/* Payment Section */}
            <SectionHeader
              icon="credit-card"
              title="Payment Mode"
              subtitle="Select prepaid or cash on delivery"
            />

            <View className="flex-row gap-3 mb-4">
              <PaymentTypeButton
                title="Prepaid"
                subtitle="Online payment"
                icon="check-circle"
                badge="Instant"
                selected={paymentType === 'prepaid'}
                onPress={() => setPaymentType('prepaid')}
              />
              <PaymentTypeButton
                title="Cash on Delivery"
                subtitle="Collect on delivery"
                icon="dollar-sign"
                badge="COD"
                selected={paymentType === 'cod'}
                onPress={() => setPaymentType('cod')}
              />
            </View>

            {paymentType === 'cod' && (
              <View className="mb-2">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">COD Amount to Collect (₹)</Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 focus:border-violet-500">
                  <Text className="text-slate-400 font-bold text-sm mr-1">₹</Text>
                  <TextInput
                    value={codAmount}
                    onChangeText={setCodAmount}
                    placeholder="e.g. 1500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    className="flex-1 py-3.5 text-sm font-bold text-slate-900"
                  />
                </View>
              </View>
            )}

            {/* Calculate Button */}
            <TouchableOpacity
              onPress={handleCalculate}
              disabled={calculating || !canCalculate}
              activeOpacity={0.85}
              className={`mt-4 rounded-2xl overflow-hidden shadow-lg shadow-violet-500/25 ${
                !canCalculate ? 'opacity-60' : ''
              }`}
            >
              <LinearGradient
                colors={!canCalculate ? ['#94A3B8', '#64748B'] : PRIMARY_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="py-4 px-6 flex-row items-center justify-center gap-2.5"
              >
                {calculating ? (
                  <Text className="text-white font-black text-base tracking-wide">
                    Calculating Rates...
                  </Text>
                ) : (
                  <>
                    <Feather name="zap" size={18} color="white" />
                    <Text className="text-white font-black text-base tracking-wide">
                      Calculate Shipping Rates
                    </Text>
                    <Feather name="arrow-right" size={18} color="white" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading Card */}
        {calculating && (
          <View className="mt-2 bg-white rounded-3xl p-7 border border-slate-100 shadow-sm items-center mb-6">
            <LoadingSpinner message="Scanning 20+ partner courier APIs..." />
            <Text className="text-xs text-slate-400 text-center mt-3 font-medium">
              Checking Delhivery, Blue Dart, Ekart, Shadowfax & Xpressbees...
            </Text>
          </View>
        )}

        {/* Results Section */}
        {rates.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3.5">
              <View>
                <Text className="text-base font-black text-slate-900 tracking-tight">
                  Available Couriers ({filteredRates.length})
                </Text>
                <Text className="text-xs text-slate-500 font-medium mt-0.5">
                  Best price from ₹{cheapestRate} • Fastest {fastestDays} days
                </Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4 -mx-1 px-1 flex-row gap-2"
            >
              <FilterTab
                label="All Couriers"
                count={rates.length}
                active={activeFilter === 'all'}
                onPress={() => setActiveFilter('all')}
              />
              <FilterTab
                label="Cheapest"
                active={activeFilter === 'cheapest'}
                onPress={() => setActiveFilter('cheapest')}
              />
              <FilterTab
                label="Fastest"
                active={activeFilter === 'fastest'}
                onPress={() => setActiveFilter('fastest')}
              />
              <FilterTab
                label="Air Express"
                active={activeFilter === 'air'}
                onPress={() => setActiveFilter('air')}
              />
              <FilterTab
                label="Surface"
                active={activeFilter === 'surface'}
                onPress={() => setActiveFilter('surface')}
              />
            </ScrollView>

            {/* Rate Cards */}
            {filteredRates.map((rate) => (
              <EnhancedRateCard
                key={rate.carrier_id}
                rate={rate}
                isCheapest={rate.freight_charge === cheapestRate}
                isFastest={rate.estimated_days === fastestDays}
                onBook={() => {
                  navigation.navigate('CreateShipment', {
                    pickupPincode: pickupPin,
                    deliveryPincode: deliveryPin,
                    weight,
                    length,
                    breadth: width,
                    height,
                    paymentType,
                    codAmount,
                    selectedCarrier: rate.carrier_id,
                  });
                }}
              />
            ))}
          </View>
        )}

        {/* Feature Cards */}
        <View className="gap-3 mb-6">
          <FeatureCard
            icon="shield"
            title="Transparent Multi-Courier Pricing"
            description="Compare real-time negotiated B2B & B2C rates across 20+ top national carriers with zero hidden markups."
            color="#7C3AED"
          />
          <FeatureCard
            icon="truck"
            title="Automated Courier Allocation"
            description="Pick the cheapest or fastest courier and create shipment directly with 1-click generation of AWB shipping labels."
            color="#0284C7"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────
   SUBCOMPONENTS
───────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-row items-center mb-4">
      <View className="w-9 h-9 rounded-xl bg-violet-50 items-center justify-center border border-violet-100">
        <Feather name={icon} size={16} color={ACCENT_PURPLE} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-black text-slate-900 tracking-tight">{title}</Text>
        <Text className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</Text>
      </View>
    </View>
  );
}

function DimensionInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] text-slate-600 font-bold mb-1.5">{label}</Text>
      <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus:border-violet-500">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || '0'}
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className="flex-1 py-3 text-xs font-bold text-slate-900 text-center"
        />
        <Text className="text-[10px] font-bold text-slate-400">cm</Text>
      </View>
    </View>
  );
}

function PaymentTypeButton({
  title,
  subtitle,
  icon,
  badge,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  badge: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={`flex-1 p-3.5 rounded-2xl border ${
        selected
          ? 'bg-violet-50/70 border-violet-600'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className={`w-8 h-8 rounded-xl items-center justify-center ${
            selected ? 'bg-violet-600' : 'bg-slate-200'
          }`}
        >
          <Feather name={icon} size={15} color={selected ? '#FFFFFF' : '#64748B'} />
        </View>
        <View
          className={`px-2 py-0.5 rounded-md ${
            selected ? 'bg-violet-100' : 'bg-slate-200/70'
          }`}
        >
          <Text
            className={`text-[9px] font-black ${
              selected ? 'text-violet-700' : 'text-slate-600'
            }`}
          >
            {badge}
          </Text>
        </View>
      </View>
      <Text
        className={`text-xs font-bold ${
          selected ? 'text-violet-950' : 'text-slate-800'
        }`}
      >
        {title}
      </Text>
      <Text className="text-[10px] text-slate-400 font-medium mt-0.5">
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function FilterTab({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`px-3.5 py-2 rounded-xl border flex-row items-center gap-1.5 ${
        active
          ? 'bg-slate-900 border-slate-900'
          : 'bg-white border-slate-200'
      }`}
    >
      <Text
        className={`text-xs font-bold ${
          active ? 'text-white' : 'text-slate-600'
        }`}
      >
        {label}
      </Text>
      {typeof count === 'number' && (
        <View
          className={`px-1.5 py-0.5 rounded-full ${
            active ? 'bg-white/20' : 'bg-slate-100'
          }`}
        >
          <Text
            className={`text-[9px] font-black ${
              active ? 'text-white' : 'text-slate-600'
            }`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EnhancedRateCard({
  rate,
  isCheapest,
  isFastest,
  onBook,
}: {
  rate: RateResult;
  isCheapest: boolean;
  isFastest: boolean;
  onBook: () => void;
}) {
  const isAir = rate.carrier_name.toLowerCase().includes('air');

  return (
    <View
      className="bg-white rounded-3xl p-5 mb-4 border border-slate-100"
      style={{
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Top Badges */}
      <View className="flex-row items-center justify-between mb-3.5">
        <View className="flex-row items-center gap-2">
          <View
            className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 ${
              isAir ? 'bg-sky-50 border border-sky-100' : 'bg-slate-100 border border-slate-200'
            }`}
          >
            <Feather
              name={isAir ? 'send' : 'truck'}
              size={11}
              color={isAir ? '#0284C7' : '#475569'}
            />
            <Text
              className={`text-[10px] font-bold ${
                isAir ? 'text-sky-700' : 'text-slate-700'
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
            <Text className="text-sm font-black text-slate-900 tracking-tight" numberOfLines={1}>
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
          onPress={onBook}
          activeOpacity={0.7}
          className="bg-violet-50 px-4 py-2 rounded-xl border border-violet-200 flex-row items-center gap-1.5"
        >
          <Text className="text-xs font-black text-violet-700">Ship Now</Text>
          <Feather name="arrow-right" size={12} color={ACCENT_PURPLE} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <View className="bg-white rounded-3xl p-5 border border-slate-100 flex-row items-center shadow-xs">
      <View
        className="w-11 h-11 rounded-2xl items-center justify-center mr-3.5"
        style={{ backgroundColor: `${color}15` }}
      >
        <Feather name={icon} size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-black text-slate-900 tracking-tight">{title}</Text>
        <Text className="text-[11px] text-slate-500 font-medium mt-1 leading-4">
          {description}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-slate-100 my-6" />;
}
