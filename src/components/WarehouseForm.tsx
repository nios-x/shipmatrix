import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text, TextInput } from './ui/Text';
import { Feather } from '@expo/vector-icons';
import { usePincode } from '../lib/usePincode';
import { isWarehouseComplete } from '../lib/shipments';
import type { WarehouseData } from '../types';
import { onlyDigits, singleSpaced } from '../lib/inputs';

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-3">
      <Text className="mb-1 font-bold text-xs text-slate-700">{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900"
        {...props}
      />
      {!!hint && <Text className="mt-1 text-[11px] text-slate-400">{hint}</Text>}
    </View>
  );
}

/**
 * Editor for the pickup warehouse. The `name` must match a pickup location
 * already registered with the courier — they reject bookings that reference an
 * unknown one — hence the explicit hint on that field.
 */
export function WarehouseForm({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: WarehouseData;
  onChange: (next: WarehouseData) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const set = (key: keyof WarehouseData) => (v: string) => onChange({ ...value, [key]: v });

  // Offer to fill city/state from the pincode without overwriting typed values.
  const { info, loading } = usePincode(value.pincode);
  const suggestion =
    info && (!value.city || !value.state)
      ? { city: value.city || info.city, state: value.state || info.state }
      : null;

  const complete = isWarehouseComplete(value);

  return (
    <View>
      <Field
        label="Warehouse Name"
        value={value.name}
        onChangeText={(v) => set('name')(singleSpaced(v))}
        placeholder="e.g. Main Warehouse"
        autoCapitalize="words"
        hint="Must match the pickup location registered with your courier."
      />
      <Field
        label="Contact Phone"
        value={value.phone}
        onChangeText={(v) => set('phone')(onlyDigits(v, 10))}
        placeholder="9876543210"
        keyboardType="number-pad"
        maxLength={10}
        autoComplete="tel"
        hint="10-digit mobile starting 6-9. Couriers reject anything else and fall back to a placeholder number."
      />
      <Field
        label="Address"
        value={value.address}
        onChangeText={(v) => set('address')(singleSpaced(v))}
        placeholder="Street, area, landmark"
        autoCapitalize="words"
        multiline
      />
      <Field
        label={loading ? 'Pincode (looking up…)' : 'Pincode'}
        value={value.pincode}
        onChangeText={(v) => set('pincode')(onlyDigits(v, 6))}
        placeholder="201301"
        keyboardType="number-pad"
        maxLength={6}
      />

      {suggestion && (
        <TouchableOpacity
          onPress={() => onChange({ ...value, ...suggestion })}
          activeOpacity={0.7}
          className="mb-3 flex-row items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
          <Feather name="map-pin" size={13} color="#7C3AED" />
          <Text className="flex-1 font-bold text-[11px] text-violet-700">
            Use {suggestion.city}, {suggestion.state}
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="City"
            value={value.city}
            onChangeText={(v) => set('city')(singleSpaced(v))}
            placeholder="Noida"
            autoCapitalize="words"
          />
        </View>
        <View className="flex-1">
          <Field
            label="State"
            value={value.state}
            onChangeText={(v) => set('state')(singleSpaced(v))}
            placeholder="UP"
            autoCapitalize="words"
          />
        </View>
      </View>

      {onSave && (
        <TouchableOpacity
          onPress={onSave}
          disabled={saving || !complete}
          activeOpacity={0.8}
          className={`mt-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
            complete ? 'bg-violet-600' : 'bg-slate-200'
          }`}>
          <Feather name="save" size={14} color={complete ? '#FFFFFF' : '#94A3B8'} />
          <Text className={`font-bold text-sm ${complete ? 'text-white' : 'text-slate-400'}`}>
            {saving ? 'Saving…' : 'Save Pickup Address'}
          </Text>
        </TouchableOpacity>
      )}

      {!complete && (
        <Text className="mt-2 text-[11px] text-amber-700">
          All fields are required before you can book a shipment.
        </Text>
      )}
    </View>
  );
}
