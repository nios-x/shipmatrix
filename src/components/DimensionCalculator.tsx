import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Text, TextInput } from './ui/Text';
import { Badge } from './ui/Badge';
import { BoxScanner } from './BoxScanner';
import { onlyDecimal } from '../lib/inputs';
import { formatCount, formatDimensions, formatWeight } from '../lib/format';
import { VOLUMETRIC_DIVISOR, dimensionError, weightBreakdown, weightError } from '../lib/weight';

/**
 * Package weight and size, and what they add up to on the invoice.
 *
 * Couriers bill the greater of a parcel's actual weight and its volumetric
 * weight. Sellers are regularly surprised by the second one, so the result is
 * shown as a comparison rather than a single number: both weights side by
 * side, the one that applies highlighted, and the arithmetic spelled out
 * underneath. The rule itself lives in `lib/weight`, mirrored from the server.
 */

export interface PackageValues {
  weight: string;
  length: string;
  width: string;
  height: string;
}

const WEIGHT_PRESETS = ['0.5', '1', '2', '5', '10'];

const BOX_PRESETS = [
  { label: 'Flyer', l: '25', w: '20', h: '2' },
  { label: 'Small box', l: '15', w: '10', h: '8' },
  { label: 'Shoe box', l: '30', w: '20', h: '12' },
  { label: 'Medium box', l: '35', w: '25', h: '18' },
];

export function DimensionCalculator({
  value,
  onChange,
  startScanning = false,
}: {
  value: PackageValues;
  onChange: (next: PackageValues) => void;
  /** Opens the camera scanner straight away, e.g. when arriving from a "Parcel size" shortcut. */
  startScanning?: boolean;
}) {
  const [scanning, setScanning] = useState(startScanning);
  // Scans resolve asynchronously; merging into the newest values keeps a
  // weight typed while the photo was being read.
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const set = (field: keyof PackageValues, raw: string) => {
    const cleaned = field === 'weight' ? onlyDecimal(raw, 4, 3) : onlyDecimal(raw, 3, 1);
    onChange({ ...value, [field]: cleaned });
  };

  const result = weightBreakdown(value.weight, value.length, value.width, value.height);

  const errors = {
    weight: weightError(value.weight),
    length: dimensionError(value.length, 'Length'),
    width: dimensionError(value.width, 'Width'),
    height: dimensionError(value.height, 'Height'),
  };
  const sizeError = errors.length || errors.width || errors.height;

  const activeBox = BOX_PRESETS.find(
    (b) => b.l === value.length && b.w === value.width && b.h === value.height
  );

  return (
    <View>
      {/* Actual weight */}
      <Text variant="label">Actual weight</Text>
      <NumberField
        value={value.weight}
        onChangeText={(v) => set('weight', v)}
        unit="kg"
        placeholder="e.g. 0.5"
        accessibilityLabel="Actual weight in kilograms"
        invalid={!!errors.weight}
        large
      />
      {errors.weight && <FieldError message={errors.weight} />}

      <ChipRow>
        {WEIGHT_PRESETS.map((w) => (
          <Chip
            key={w}
            label={`${w} kg`}
            active={value.weight !== '' && Number(value.weight) === Number(w)}
            onPress={() => onChange({ ...value, weight: w })}
          />
        ))}
      </ChipRow>

      {/* Dimensions */}
      <View className="mt-5 flex-row items-center justify-between">
        <Text variant="label">Box dimensions · cm</Text>
        {!scanning && <ScanButton onPress={() => setScanning(true)} />}
      </View>

      {scanning && (
        <BoxScanner
          onClose={() => setScanning(false)}
          onMeasured={(size) =>
            onChange({
              ...latestValue.current,
              length: size.length,
              width: size.width,
              ...(size.height ? { height: size.height } : {}),
            })
          }
        />
      )}

      <View className="mt-1.5 flex-row items-end">
        <DimensionSlot
          label="Length"
          value={value.length}
          onChangeText={(v) => set('length', v)}
          invalid={!!errors.length}
        />
        <Times />
        <DimensionSlot
          label="Width"
          value={value.width}
          onChangeText={(v) => set('width', v)}
          invalid={!!errors.width}
        />
        <Times />
        <DimensionSlot
          label="Height"
          value={value.height}
          onChangeText={(v) => set('height', v)}
          invalid={!!errors.height}
        />
      </View>
      {sizeError && <FieldError message={sizeError} />}

      <ChipRow>
        {BOX_PRESETS.map((b) => (
          <Chip
            key={b.label}
            label={b.label}
            detail={`${b.l}×${b.w}×${b.h}`}
            active={activeBox === b}
            onPress={() => onChange({ ...value, length: b.l, width: b.w, height: b.h })}
          />
        ))}
      </ChipRow>

      <WeightResult
        actual={result.actual}
        volumetric={result.volumetric}
        chargeable={result.chargeable}
        basis={result.basis}
        ready={result.ready}
        dimensions={formatDimensions(value.length, value.width, value.height)}
      />
    </View>
  );
}

/** Opens the camera scanner. Shared with the booking form so both read the same. */
export function ScanButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Scan the box with the camera"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      className="h-8 flex-row items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3">
      <Feather name="aperture" size={13} color="#6D28D9" />
      <Text className="font-semibold text-[12px] text-violet-800">Scan box</Text>
    </TouchableOpacity>
  );
}

/* ─── Result ─────────────────────────────────────────── */

function WeightResult({
  actual,
  volumetric,
  chargeable,
  basis,
  ready,
  dimensions,
}: ReturnType<typeof weightBreakdown> & { dimensions: string | null }) {
  const scale = Math.max(actual, volumetric) || 1;

  return (
    <View className="mt-5 rounded-xl bg-slate-50 px-4 pb-4 pt-3.5" accessibilityLiveRegion="polite">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="label">Chargeable weight</Text>
          <Text
            className={`mt-1 font-bold text-[30px] leading-9 tracking-tight ${
              ready ? 'text-slate-900' : 'text-slate-300'
            }`}
            numberOfLines={1}>
            {ready ? formatWeight(chargeable) : '— kg'}
          </Text>
        </View>
        {ready && actual > 0 && volumetric > 0 && (
          <View className="pt-0.5">
            <Badge
              tone={basis === 'volumetric' ? 'brand' : 'positive'}
              label={basis === 'volumetric' ? 'Volumetric applies' : 'Actual applies'}
            />
          </View>
        )}
      </View>

      {ready ? (
        <View className="mt-3 gap-2.5">
          <WeightBar
            label="Actual"
            value={actual}
            fraction={actual / scale}
            highlight={basis === 'actual'}
          />
          <WeightBar
            label="Volumetric"
            value={volumetric}
            fraction={volumetric / scale}
            highlight={basis === 'volumetric'}
          />
        </View>
      ) : (
        <Text variant="body" className="mt-1 text-slate-500">
          Enter the weight and box size to see what couriers will bill.
        </Text>
      )}

      {dimensions && volumetric > 0 && (
        <Text variant="meta" className="mt-3">
          {dimensions} ÷ {formatCount(VOLUMETRIC_DIVISOR)} = {formatWeight(volumetric)}
        </Text>
      )}

      {basis === 'volumetric' && actual > 0 && (
        <View className="mt-3 flex-row items-start gap-2 border-t border-slate-200/70 pt-3">
          <Feather name="info" size={13} color="#6D28D9" style={{ marginTop: 2 }} />
          <Text variant="meta" className="flex-1 text-slate-600">
            This parcel is billed on its size. A snugger box could bring the billed weight down
            toward {formatWeight(actual)}.
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * One weight as a bar, scaled against the heavier of the two so the gap is
 * visible at a glance. Width eases to its new value when an input changes —
 * the only motion in the calculator, and it carries information.
 */
function WeightBar({
  label,
  value,
  fraction,
  highlight,
}: {
  label: string;
  value: number;
  fraction: number;
  highlight: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(fraction));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: fraction,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fraction, progress]);

  return (
    <View className="flex-row items-center">
      <Text variant="meta" className="w-[76px] text-slate-600">
        {label}
      </Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
        <Animated.View
          style={{
            height: '100%',
            width: '100%',
            borderRadius: 999,
            backgroundColor: highlight ? '#7C3AED' : '#94A3B8',
            transformOrigin: 'left',
            transform: [{ scaleX: progress }],
          }}
        />
      </View>
      <Text
        className={`ml-3 w-[64px] text-right text-[13px] ${
          highlight ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'
        }`}
        numberOfLines={1}>
        {value > 0 ? formatWeight(value) : '—'}
      </Text>
    </View>
  );
}

/* ─── Inputs ─────────────────────────────────────────── */

function NumberField({
  value,
  onChangeText,
  unit,
  placeholder,
  accessibilityLabel,
  invalid,
  large,
}: {
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  placeholder: string;
  accessibilityLabel: string;
  invalid?: boolean;
  large?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  const border = invalid ? 'border-rose-400' : focused ? 'border-violet-500' : 'border-slate-200';
  const surface = focused ? 'bg-white' : 'bg-slate-50';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => input.current?.focus()}
      className={`mt-1.5 flex-row items-center rounded-xl border ${border} ${surface} ${
        large ? 'h-14 px-3.5' : 'h-12 px-2'
      }`}>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
        className={`min-w-0 flex-1 py-0 font-semibold text-slate-900 ${
          large ? 'text-xl' : 'text-center text-lg'
        }`}
      />
      {unit && <Text className="ml-2 font-medium text-sm text-slate-500">{unit}</Text>}
    </TouchableOpacity>
  );
}

function DimensionSlot({
  label,
  value,
  onChangeText,
  invalid,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <View className="flex-1">
      <Text variant="meta" className="text-slate-600">
        {label}
      </Text>
      <NumberField
        value={value}
        onChangeText={onChangeText}
        placeholder="—"
        accessibilityLabel={`${label} in centimetres`}
        invalid={invalid}
      />
    </View>
  );
}

function Times() {
  return (
    <View className="h-12 w-6 items-center justify-center">
      <Text className="font-medium text-base text-slate-400">×</Text>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <View className="mt-1.5 flex-row items-center gap-1.5">
      <Feather name="alert-circle" size={12} color="#E11D48" />
      <Text variant="meta" className="text-rose-600">
        {message}
      </Text>
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="mt-2.5"
      contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  detail,
  active,
  onPress,
}: {
  label: string;
  detail?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3 ${
        active ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white'
      }`}>
      <Text
        className={`font-semibold text-[13px] ${active ? 'text-violet-800' : 'text-slate-700'}`}>
        {label}
      </Text>
      {detail && (
        <Text className={`font-medium text-xs ${active ? 'text-violet-700' : 'text-slate-500'}`}>
          {detail}
        </Text>
      )}
    </TouchableOpacity>
  );
}
