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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { api, routes } from '../lib/api';
import { toast } from '../lib/alert';
import { parseRates, type RateResult } from '../lib/rates';
import { PINCODE_RE, onlyDigits } from '../lib/inputs';
import { dimensionError, weightError } from '../lib/weight';
import { DimensionCalculator, type PackageValues } from '../components/DimensionCalculator';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export type { RateResult };

const SAMPLE_ROUTES = [
  { label: 'DEL → BOM', pickup: '110001', delivery: '400001' },
  { label: 'BLR → DEL', pickup: '560001', delivery: '110001' },
  { label: 'HYD → MAA', pickup: '500001', delivery: '600001' },
  { label: 'CCU → BOM', pickup: '700001', delivery: '400001' },
];

const EMPTY_PACKAGE: PackageValues = { weight: '', length: '', width: '', height: '' };

export default function RateCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [calculating, setCalculating] = useState(false);
  const [pickupPin, setPickupPin] = useState('');
  const [deliveryPin, setDeliveryPin] = useState('');
  const [pkg, setPkg] = useState<PackageValues>(EMPTY_PACKAGE);

  // The dashboard's "Parcel size" shortcut lands here with a fresh `scan` stamp.
  // Keying the calculator on it reopens the scanner on every tap, while the
  // package values themselves live here and survive the remount.
  const scanRequest: number | undefined = route.params?.scan;

  const handleSwapPincodes = () => {
    setPickupPin(deliveryPin);
    setDeliveryPin(pickupPin);
  };

  const handleReset = () => {
    setPickupPin('');
    setDeliveryPin('');
    setPkg(EMPTY_PACKAGE);
    toast.info('Calculator Reset', 'All input fields have been cleared.');
  };

  const handleCalculate = async () => {
    if (!PINCODE_RE.test(pickupPin)) {
      toast.warning('Invalid Pickup Pincode', 'Please enter a valid 6-digit pickup pincode.');
      return;
    }
    if (!PINCODE_RE.test(deliveryPin)) {
      toast.warning('Invalid Delivery Pincode', 'Please enter a valid 6-digit delivery pincode.');
      return;
    }
    if (!pkg.weight || Number(pkg.weight) <= 0) {
      toast.warning('Invalid Weight', 'Please enter a shipment weight greater than 0.');
      return;
    }
    const sizeProblem =
      weightError(pkg.weight) ||
      dimensionError(pkg.length, 'Length') ||
      dimensionError(pkg.width, 'Width') ||
      dimensionError(pkg.height, 'Height');
    if (sizeProblem) {
      toast.warning('Check the package', `${sizeProblem}.`);
      return;
    }

    setCalculating(true);

    try {
      const data = await api.post(routes.rates, {
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        weight: pkg.weight,
        length: pkg.length || '10',
        breadth: pkg.width || '10',
        height: pkg.height || '10',
        paymentType: 'prepaid',
        codAmount: '0',
      });

      if (data.success && Array.isArray(data.data)) {
        const parsedRates: RateResult[] = parseRates(data.data);

        navigation.navigate('AvailableCouriers', {
          pickupPin,
          deliveryPin,
          weight: pkg.weight,
          length: pkg.length || '10',
          width: pkg.width || '10',
          height: pkg.height || '10',
          rates: parsedRates,
        });
      } else {
        toast.error(
          'Calculation Failed',
          data.message || 'Unable to fetch rates for these pincodes.'
        );
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        'Network Error',
        error?.message || 'Could not connect to rate calculator service.'
      );
    } finally {
      setCalculating(false);
    }
  };

  const canCalculate =
    PINCODE_RE.test(pickupPin) && PINCODE_RE.test(deliveryPin) && Number(pkg.weight) > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1">
          <Text variant="title">Rate Calculator</Text>
          <Text variant="meta" className="mt-0.5">
            Compare live prices across couriers
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reset calculator"
          className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Feather name="rotate-ccw" size={16} color="#334155" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Route */}
        <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Text variant="heading">Route</Text>

          <View className="mt-3 flex-row items-end">
            <PincodeField
              label="Pickup"
              icon="arrow-up-right"
              iconColor="#059669"
              value={pickupPin}
              onChangeText={(t) => setPickupPin(onlyDigits(t, 6))}
              placeholder="e.g. 110001"
            />

            <TouchableOpacity
              onPress={handleSwapPincodes}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Swap pickup and delivery pincodes"
              className="mx-1 h-12 w-10 items-center justify-center">
              <Feather name="repeat" size={16} color="#475569" />
            </TouchableOpacity>

            <PincodeField
              label="Delivery"
              icon="arrow-down-left"
              iconColor="#0369A1"
              value={deliveryPin}
              onChangeText={(t) => setDeliveryPin(onlyDigits(t, 6))}
              placeholder="e.g. 400001"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="mt-3"
            contentContainerStyle={{ gap: 8 }}>
            {SAMPLE_ROUTES.map((r) => {
              const selected = pickupPin === r.pickup && deliveryPin === r.delivery;
              return (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => {
                    setPickupPin(r.pickup);
                    setDeliveryPin(r.delivery);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`h-9 justify-center rounded-full border px-3 ${
                    selected ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white'
                  }`}>
                  <Text
                    className={`font-semibold text-[13px] ${
                      selected ? 'text-violet-800' : 'text-slate-700'
                    }`}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Package */}
        <View className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Text variant="heading">Package</Text>
          <Text variant="meta" className="mb-4 mt-0.5">
            Couriers bill the higher of actual and volumetric weight.
          </Text>

          <DimensionCalculator
            key={scanRequest ?? 'calculator'}
            value={pkg}
            onChange={setPkg}
            startScanning={scanRequest != null}
          />
        </View>

        <TouchableOpacity
          onPress={handleCalculate}
          disabled={calculating}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ busy: calculating }}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-xl ${
            canCalculate ? 'bg-violet-600' : 'bg-violet-600/50'
          }`}>
          {calculating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text variant="button" className="text-white">
                Checking couriers…
              </Text>
            </>
          ) : (
            <>
              <Text variant="button" className="text-white">
                Find Available Couriers
              </Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <View className="mt-5 gap-3 px-1">
          <Assurance
            icon="shield"
            title="Transparent multi-courier pricing"
            description="Compare real-time negotiated B2B & B2C rates across 20+ top national carriers with zero hidden markups."
          />
          <Assurance
            icon="truck"
            title="Automated courier allocation"
            description="Pick the cheapest or fastest courier and create shipment directly with 1-click generation of AWB shipping labels."
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────
   SUBCOMPONENTS
───────────────────────────────────────────── */

function PincodeField({
  label,
  icon,
  iconColor,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  const invalid = value.length === 6 && !PINCODE_RE.test(value);

  return (
    <View className="flex-1">
      <Text variant="meta" className="text-slate-600">
        {label}
      </Text>
      <View
        className={`mt-1.5 h-12 flex-row items-center rounded-xl border px-3 ${
          invalid ? 'border-rose-400' : focused ? 'border-violet-500' : 'border-slate-200'
        } ${focused ? 'bg-white' : 'bg-slate-50'}`}>
        <Feather name={icon} size={14} color={iconColor} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType="number-pad"
          maxLength={6}
          accessibilityLabel={`${label} pincode`}
          className="ml-2 min-w-0 flex-1 py-0 font-semibold text-base text-slate-900"
        />
      </View>
    </View>
  );
}

function Assurance({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Feather name={icon} size={15} color="#64748B" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="font-semibold text-[13px] leading-5 text-slate-700">{title}</Text>
        <Text variant="meta" className="mt-0.5 leading-[18px]">
          {description}
        </Text>
      </View>
    </View>
  );
}
