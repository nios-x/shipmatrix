import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from '../lib/alert';
import { WarehouseForm } from '../components/WarehouseForm';
import { isWarehouseComplete, EMPTY_WAREHOUSE } from '../lib/shipments';
import type { WarehouseData } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const DEFAULT_PREFS = {
    emailNotif: true,
    smsNotif: true,
    pushNotif: true,
    autoLabel: false,
  };

  // Saved preferences are the source of truth; a pending toggle is held as an
  // override so the switch responds instantly while the write is in flight.
  const [pending, setPending] = useState<typeof DEFAULT_PREFS | null>(null);
  const notificationSettings = pending ?? { ...DEFAULT_PREFS, ...(user?.notificationPrefs || {}) };

  const toggleSetting = async (key: keyof typeof DEFAULT_PREFS) => {
    const next = { ...notificationSettings, [key]: !notificationSettings[key] };
    setPending(next);
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { notificationPrefs: next });
      // Drop the override so the profile snapshot takes over again.
      setPending(null);
    } catch {
      setPending(null);
      toast.error('Error', 'Could not save that preference.');
    }
  };

  const settings = [
    {
      key: 'emailNotif' as const,
      label: 'Email Notifications',
      icon: 'mail',
      desc: 'Order status updates & reports',
    },
    {
      key: 'smsNotif' as const,
      label: 'SMS Notifications',
      icon: 'message-square',
      desc: 'Instant delivery alerts',
    },
    {
      key: 'pushNotif' as const,
      label: 'Push Notifications',
      icon: 'bell',
      desc: 'Important shipment updates',
    },
    {
      key: 'autoLabel' as const,
      label: 'Auto-download Labels',
      icon: 'download',
      desc: 'Save shipping labels automatically',
    },
  ];

  // Pickup warehouse — defaults to the saved value, an edit takes over.
  const [warehouseEdit, setWarehouseEdit] = useState<WarehouseData | null>(null);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const warehouse: WarehouseData = warehouseEdit ?? {
    ...EMPTY_WAREHOUSE,
    ...(user?.warehouseData || {}),
  };
  const warehouseReady = isWarehouseComplete(warehouse);

  const handleSaveWarehouse = async () => {
    if (!auth.currentUser || !warehouseReady) return;
    setSavingWarehouse(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { warehouseData: warehouse });
      setWarehouseEdit(null);
      toast.success('Saved', 'This pickup address will be used for new shipments.');
    } catch {
      toast.error('Error', 'Could not save the pickup address.');
    } finally {
      setSavingWarehouse(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#F8FAFC]"
      style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="font-black text-xl tracking-tight text-slate-900">Settings</Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-500">
              Preferences & account configurations
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Pickup Warehouse Card */}
        <View className="shadow-xs mx-5 mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white">
          <TouchableOpacity
            onPress={() => setWarehouseOpen((open) => !open)}
            activeOpacity={0.7}
            className="flex-row items-center gap-3 px-4 py-3.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
              <Feather name="home" size={17} color="#64748B" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-slate-900">Pickup Address</Text>
              <Text className="mt-0.5 font-medium text-xs text-slate-400" numberOfLines={1}>
                {warehouseReady
                  ? `${warehouse.name} · ${warehouse.city} ${warehouse.pincode}`
                  : 'Required before booking shipments'}
              </Text>
            </View>
            {!warehouseReady && (
              <View className="mr-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5">
                <Text className="font-black text-[9px] text-amber-700">SET UP</Text>
              </View>
            )}
            <Feather
              name={warehouseOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#94A3B8"
            />
          </TouchableOpacity>

          {warehouseOpen && (
            <View className="border-t border-slate-100 px-4 pb-4 pt-1">
              <WarehouseForm
                value={warehouse}
                onChange={setWarehouseEdit}
                onSave={handleSaveWarehouse}
                saving={savingWarehouse}
              />
            </View>
          )}
        </View>

        {/* Notifications Card */}
        <View className="shadow-xs mx-5 mb-4 rounded-3xl border border-slate-100 bg-white p-2">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Notification Preferences
            </Text>
          </View>

          {settings.map((setting, index) => (
            <View
              key={setting.key}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                index < settings.length - 1 ? 'border-b border-slate-100' : ''
              }`}>
              <View className="flex-1 flex-row items-center gap-3 pr-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                  <Feather name={setting.icon as any} size={17} color="#64748B" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-sm text-slate-900">{setting.label}</Text>
                  <Text className="mt-0.5 font-medium text-xs text-slate-400">{setting.desc}</Text>
                </View>
              </View>
              <Switch
                value={notificationSettings[setting.key]}
                onValueChange={() => toggleSetting(setting.key)}
                trackColor={{ true: '#7C3AED', false: '#E2E8F0' }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Account Info Card */}
        <View className="shadow-xs mx-5 rounded-3xl border border-slate-100 bg-white p-4">
          <Text className="mb-3 font-bold text-xs uppercase tracking-wider text-slate-400">
            Account Details
          </Text>

          <View className="space-y-2.5">
            <View className="flex-row items-center justify-between border-b border-slate-100 py-2">
              <Text className="font-semibold text-xs text-slate-500">Email Address</Text>
              <Text className="font-bold text-xs text-slate-800">{user?.email || 'N/A'}</Text>
            </View>

            <View className="flex-row items-center justify-between border-b border-slate-100 py-2">
              <Text className="font-semibold text-xs text-slate-500">Phone Number</Text>
              <Text className="font-bold text-xs text-slate-800">
                {user?.phone || 'Not configured'}
              </Text>
            </View>

            <View className="flex-row items-center justify-between border-b border-slate-100 py-2">
              <Text className="font-semibold text-xs text-slate-500">Account Role</Text>
              <View className="rounded-md border border-violet-100 bg-violet-50 px-2.5 py-0.5">
                <Text className="font-bold text-[11px] uppercase text-violet-700">
                  {user?.role || 'User'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <Text className="font-semibold text-xs text-slate-500">API Key</Text>
              <Text className="font-bold font-mono text-xs text-slate-800">
                {user?.apiKey ? '••••••••' + user.apiKey.slice(-6) : 'Not Generated'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
