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
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';

export interface RateResult {
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
  const [pickupPin, setPickupPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

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

    try {
      const data = await api.post('/api/rates', {
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        weight,
        length: length || '10',
        breadth: width || '10',
        height: height || '10',
        paymentType: 'prepaid',
        codAmount: '0',
      });

      if (data.success && Array.isArray(data.data)) {
        const parsedRates: RateResult[] = data.data.map((r: any) => ({
          carrier_id: r.carrier_id,
          carrier_name: r.carrier_name || r.carrier_id,
          freight_charge: r.freight_charge,
          estimated_days: r.estimated_days || Math.floor(Math.random() * 3) + 2,
        }));

        navigation.navigate('AvailableCouriers', {
          pickupPin,
          deliveryPin,
          weight,
          length: length || '10',
          width: width || '10',
          height: height || '10',
          rates: parsedRates,
        });
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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-xl font-black text-slate-900 tracking-tight">
            Rate Calculator
          </Text>
          <Text className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time multi-courier shipping estimates
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-xl bg-violet-50 items-center justify-center border border-violet-100"
        >
          <Feather name="rotate-ccw" size={16} color={ACCENT_PURPLE} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 14,
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
                  className={`px-3.5 py-2 mr-1 rounded-xl border flex-row items-center gap-1.5 ${isSelected
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
                    className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-700'
                      }`}
                  >
                    {route.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Form Card */}
        <View className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs mb-6">
          <SectionHeader
            icon="map-pin"
            title="Pickup & Delivery Pincodes"
            subtitle="Enter valid 6-digit Indian pincodes"
          />

          {/* Pincodes Input Row */}
          <View className="flex-row items-center gap-2 mb-6">
            <View className="flex-1">
              <Text className="text-[11px] text-slate-600 font-bold mb-1.5">Pickup Pincode</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus:border-violet-500">
                <Feather name="arrow-up-right" size={14} color="#10B981" />
                <TextInput
                  value={pickupPin}
                  onChangeText={(t) => setPickupPin(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 110001"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  className="flex-1 py-3 px-2 text-xs font-bold text-slate-900"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSwapPincodes}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 items-center justify-center self-end mb-0.5"
            >
              <Feather name="repeat" size={14} color={ACCENT_PURPLE} />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-[11px] text-slate-600 font-bold mb-1.5">Delivery Pincode</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus:border-violet-500">
                <Feather name="arrow-down-left" size={14} color="#0284C7" />
                <TextInput
                  value={deliveryPin}
                  onChangeText={(t) => setDeliveryPin(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 400001"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  className="flex-1 py-3 px-2 text-xs font-bold text-slate-900"
                />
              </View>
            </View>
          </View>

          <View className="h-[1px] bg-slate-100 w-full mb-6" />

          {/* Weight Section */}
          <SectionHeader
            icon="anchor"
            title="Dead Weight"
            subtitle="Actual shipment weight in Kilograms"
          />

          <View className="mb-4">
            <Text className="text-[11px] text-slate-600 font-bold mb-1.5">Dead Weight (kg)</Text>
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus:border-violet-500">
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 0.5"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                className="flex-1 py-3 text-xs font-bold text-slate-900"
              />
              <Text className="text-[11px] font-bold text-slate-400">KG</Text>
            </View>
          </View>

          {/* Weight Quick Presets */}
          <View className="flex-row items-center gap-2 mb-6">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Presets:
            </Text>
            {WEIGHT_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setWeight(preset)}
                activeOpacity={0.7}
                className={`px-2.5 py-1 rounded-lg border ${weight === preset
                  ? 'bg-violet-600 border-violet-600'
                  : 'bg-slate-50 border-slate-200'
                  }`}
              >
                <Text
                  className={`text-[10px] font-bold ${weight === preset ? 'text-white' : 'text-slate-600'
                    }`}
                >
                  {preset} kg
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="h-[1px] bg-slate-100 w-full mb-6" />

          {/* Dimensions Section */}
          <SectionHeader
            icon="box"
            title="Package Dimensions"
            subtitle="Calculates volumetric weight (L × W × H / 5000)"
          />

          {/* Box Presets */}
          <View className="mb-4">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Standard Box Sizes:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">

              {BOX_PRESETS.map((box) => (
                <TouchableOpacity
                  key={box.label}
                  onPress={() => handleApplyBoxPreset(box)}
                  activeOpacity={0.7}
                  className="bg-slate-50 border border-slate-200 px-3 m-1 py-1 rounded-xl"
                >
                  <Text className="text-[11px] font-bold text-slate-700">{box.label}</Text>
                  <Text className="text-[9px] text-slate-400 font-medium">
                    {box.l}×{box.w}×{box.h} cm
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </View>

          {/* Dimensions Inputs */}
          <View className="mb-4">
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

          {/* Calculate Button */}
          <TouchableOpacity
            onPress={handleCalculate}
            className={`mt-5 rounded-2xl overflow-hidden  shadow-lg bg-violet-600 shadow-violet-500/25 rounded-full 
              }`}
          >
            <View
              className="py-2 px-6 flex-row items-center justify-center gap-2.5"
            >
              {calculating ? (
                <Text className="text-white font-black text-sm tracking-wide px-5 py-1">
                  Scanning Partner Couriers...
                </Text>
              ) : (
                <>
                  <Text className="text-white font-black   text-sm tracking-wide py-1">
                    Find Available Couriers
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Loading Card */}
        {calculating && (
          <View className="mt-2 bg-white rounded-3xl p-7 border border-slate-100 items-center mb-6">
            <LoadingSpinner message="Scanning 20+ partner courier APIs..." />
            <Text className="text-xs text-slate-400 text-center mt-3 font-medium">
              Checking Delhivery, Blue Dart, Ekart, Shadowfax & Xpressbees...
            </Text>
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
