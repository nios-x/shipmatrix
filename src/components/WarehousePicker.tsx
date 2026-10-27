import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './ui/Text';
import { Feather } from '@expo/vector-icons';
import { WarehouseForm } from './WarehouseForm';
import { useConfirm } from './useConfirm';
import { toast } from '../lib/alert';
import { EMPTY_WAREHOUSE, isWarehouseComplete } from '../lib/shipments';
import { deleteWarehouse, sameWarehouse, saveWarehouse } from '../lib/useWarehouses';
import type { WarehouseData } from '../types';

/**
 * Lists the saved pickup warehouses and lets the user choose one, add another,
 * edit or delete. Selection is the caller's: a booking passes its own pick, the
 * settings screen passes the default and makes a tap change it.
 */
export function WarehousePicker({
  warehouses,
  defaultWarehouse,
  loading,
  selected,
  onSelect,
  selectOnSave = true,
  newPincode,
}: {
  warehouses: WarehouseData[];
  defaultWarehouse: WarehouseData | null;
  loading: boolean;
  selected: WarehouseData | null;
  /** `null` drops the pick, falling back to the default. */
  onSelect: (w: WarehouseData | null) => void;
  /** Picks a warehouse once it is saved. Off where picking means something else. */
  selectOnSave?: boolean;
  /** Prefills the pincode of a new warehouse, e.g. from the rate calculator. */
  newPincode?: string;
}) {
  const { confirm, confirmDialog } = useConfirm();
  // The warehouse open in the form; null shows the list.
  const [draft, setDraft] = useState<WarehouseData | null>(null);
  // The entry as it was when editing began — null for a new one. Whether it
  // was the default is decided from this, not from the edited name and
  // pincode, which may no longer match an entry that has no id.
  const [original, setOriginal] = useState<WarehouseData | null>(null);
  const [saving, setSaving] = useState(false);
  // Shown until the snapshot brings a first save into the list, so the form
  // does not reopen empty in between.
  const [lastSaved, setLastSaved] = useState<WarehouseData | null>(null);
  const list = warehouses.length === 0 && lastSaved ? [lastSaved] : warehouses;

  const blank = (): WarehouseData => ({ ...EMPTY_WAREHOUSE, pincode: newPincode || '' });
  // With nothing saved there is nothing to pick from, so the form is the list.
  const editing = draft ?? (!loading && list.length === 0 ? blank() : null);

  const handleSave = async () => {
    if (!editing || !isWarehouseComplete(editing)) return;
    setSaving(true);
    try {
      const wasDefault = !defaultWarehouse || sameWarehouse(defaultWarehouse, original);
      const stored = await saveWarehouse(editing, wasDefault);
      if (selectOnSave || sameWarehouse(selected, original)) onSelect(stored);
      setLastSaved(stored);
      setDraft(null);
      toast.success('Saved', `${stored.name} is saved to your pickup addresses.`);
    } catch {
      toast.error('Error', 'Could not save the pickup address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (w: WarehouseData) => {
    confirm(
      {
        title: 'Delete warehouse?',
        message: `${w.name} will be removed from your pickup addresses.`,
        confirmText: 'Delete',
        destructive: true,
      },
      async () => {
        try {
          await deleteWarehouse(w, warehouses, defaultWarehouse);
          setLastSaved(null);
          if (sameWarehouse(selected, w)) onSelect(null);
        } catch {
          toast.error('Error', 'Could not delete the warehouse.');
        }
      }
    );
  };

  if (loading && list.length === 0) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  if (editing) {
    return (
      <View>
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-bold text-sm text-slate-900">
            {original ? 'Edit Warehouse' : 'New Warehouse'}
          </Text>
          {list.length > 0 && (
            <TouchableOpacity onPress={() => setDraft(null)} activeOpacity={0.7} hitSlop={8}>
              <Text className="font-bold text-xs text-slate-500">Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
        <WarehouseForm value={editing} onChange={setDraft} onSave={handleSave} saving={saving} />
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      {list.map((w) => {
        const isSelected = sameWarehouse(selected, w);
        const isDefault = sameWarehouse(defaultWarehouse, w);
        const complete = isWarehouseComplete(w);
        return (
          <TouchableOpacity
            key={w.id || `${w.name}-${w.pincode}`}
            onPress={() => onSelect(w)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            className={`flex-row gap-3 rounded-xl border-2 p-3 ${
              isSelected ? 'border-violet-600 bg-violet-50/60' : 'border-slate-100 bg-white'
            }`}>
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${
                isSelected ? 'border-violet-600 bg-violet-600' : 'border-slate-300'
              }`}>
              {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="shrink font-bold text-sm text-slate-900" numberOfLines={1}>
                  {w.name}
                </Text>
                {isDefault && (
                  <View className="rounded-md bg-slate-100 px-1.5 py-0.5">
                    <Text className="font-black text-[9px] text-slate-500">DEFAULT</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
                {[w.address, w.city].filter(Boolean).join(', ')} - {w.pincode}
              </Text>
              {!!w.phone && (
                <Text className="mt-1 text-[11px] text-slate-400">Contact: {w.phone}</Text>
              )}
              {!complete && (
                <Text className="mt-1 font-bold text-[11px] text-amber-700">
                  Missing details — tap edit to finish before booking.
                </Text>
              )}
            </View>

            <View className="flex-row items-start gap-1">
              <TouchableOpacity
                onPress={() => {
                  setOriginal(w);
                  setDraft(w);
                }}
                activeOpacity={0.7}
                hitSlop={6}
                accessibilityLabel={`Edit ${w.name}`}
                className="h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                <Feather name="edit-2" size={14} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(w)}
                activeOpacity={0.7}
                hitSlop={6}
                accessibilityLabel={`Delete ${w.name}`}
                className="h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                <Feather name="trash-2" size={14} color="#E11D48" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={() => {
          setOriginal(null);
          setDraft(blank());
        }}
        activeOpacity={0.7}
        className="flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3">
        <Feather name="plus" size={15} color="#7C3AED" />
        <Text className="font-bold text-sm text-violet-700">Add Warehouse</Text>
      </TouchableOpacity>

      {confirmDialog}
    </View>
  );
}
