import React, { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatCurrency } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useShipments } from '../lib/useShipments';
import { useUser } from '../lib/useUser';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import {
  isCod,
  isDelivered,
  isRemitted,
  codValue,
  toDate,
  formatDate,
  destinationLabel,
} from '../lib/shipments';
import type { Shipment } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Tab = 'pending' | 'settled' | 'bank';

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'settled', label: 'Settled', icon: 'check-circle' },
  { key: 'bank', label: 'Bank Details', icon: 'credit-card' },
];

export default function CodRemittanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments, loading } = useShipments();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [saving, setSaving] = useState(false);

  // Defaults to whatever is saved on the profile; an edit takes over as an
  // override, so the saved values appear as soon as the profile loads.
  const [bankEdit, setBankEdit] = useState<{
    accountName: string;
    accountNumber: string;
    ifsc: string;
  } | null>(null);
  const bankDetails = bankEdit ?? {
    accountName: user?.bankDetails?.accountName || '',
    accountNumber: user?.bankDetails?.accountNumber || '',
    ifsc: user?.bankDetails?.ifsc || '',
  };
  const setBankDetails = (update: (prev: typeof bankDetails) => typeof bankDetails) =>
    setBankEdit(update(bankDetails));

  const { pending, settled, pendingAmount, settledAmount } = useMemo(() => {
    const codOrders = shipments.filter((s) => isCod(s) && isDelivered(s));
    const pendingList = codOrders.filter((s) => !isRemitted(s));
    const settledList = codOrders
      .filter(isRemitted)
      .sort(
        (a, b) => (toDate(b.remittedAt)?.getTime() || 0) - (toDate(a.remittedAt)?.getTime() || 0)
      );

    const sum = (list: Shipment[]) => list.reduce((total, s) => total + codValue(s), 0);

    return {
      pending: pendingList,
      settled: settledList,
      pendingAmount: sum(pendingList),
      settledAmount: sum(settledList),
    };
  }, [shipments]);

  const handleSaveBankDetails = async () => {
    if (!user) return;
    if (!bankDetails.accountName.trim() || !bankDetails.accountNumber.trim()) {
      toast.warning('Missing Details', 'Account holder name and account number are required.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifsc)) {
      toast.warning('Invalid IFSC', 'Enter a valid 11-character IFSC code, e.g. HDFC0001234.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { bankDetails });
      toast.success('Saved', 'Your COD settlement account has been updated.');
    } catch {
      toast.error('Error', 'Could not save your bank details.');
    } finally {
      setSaving(false);
    }
  };

  const rows = activeTab === 'pending' ? pending : settled;

  const renderRow = ({ item }: { item: Shipment }) => (
    <View className="mb-3 rounded-2xl border border-gray-100 bg-white p-4" style={{ elevation: 1 }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-bold text-sm text-gray-900">AWB: {item.awb || 'N/A'}</Text>
          <Text className="mt-0.5 text-[11px] text-gray-500" numberOfLines={1}>
            {item.isCodRemittance ? item.description : `To: ${destinationLabel(item)}`}
          </Text>
        </View>
        <View
          className={`rounded-md px-2 py-0.5 ${isRemitted(item) ? 'bg-green-100' : 'bg-orange-100'}`}>
          <Text
            className={`font-bold text-[10px] uppercase ${
              isRemitted(item) ? 'text-green-700' : 'text-orange-700'
            }`}>
            {isRemitted(item) ? 'Settled' : 'Pending'}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
        <Text className="text-xs text-gray-500">COD Amount</Text>
        <Text className="font-black text-gray-900">{formatCurrency(codValue(item))}</Text>
      </View>

      {isRemitted(item) && item.remittedAt && (
        <Text className="mt-2 text-[10px] text-gray-400">
          Paid on {formatDate(item.remittedAt)}
        </Text>
      )}
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen message="Loading remittances..." />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
      style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="font-black text-xl text-gray-900">COD Remittance</Text>
      </View>

      {/* Summary */}
      <View className="mb-4 flex-row gap-3 px-5">
        <View className="flex-1 rounded-2xl border border-blue-100 bg-blue-50 p-3.5">
          <Text className="font-bold text-[10px] uppercase tracking-wider text-blue-600">
            Next Settlement
          </Text>
          <Text className="mt-1 font-black text-xl text-blue-900">
            {formatCurrency(pendingAmount)}
          </Text>
          <Text className="mt-0.5 text-[11px] text-blue-500">{pending.length} orders pending</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-green-100 bg-green-50 p-3.5">
          <Text className="font-bold text-[10px] uppercase tracking-wider text-green-600">
            Total Settled
          </Text>
          <Text className="mt-1 font-black text-xl text-green-900">
            {formatCurrency(settledAmount)}
          </Text>
          <Text className="mt-0.5 text-[11px] text-green-500">{settled.length} orders paid</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="mb-3 px-5">
        <View className="flex-row gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 ${
                  active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
                }`}>
                <Feather name={tab.icon} size={12} color={active ? '#FFFFFF' : '#64748B'} />
                <Text
                  className={`font-bold text-[11px] ${active ? 'text-white' : 'text-slate-600'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeTab === 'bank' ? (
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View
            className="mb-6 rounded-2xl border border-gray-100 bg-white p-5"
            style={{ elevation: 1 }}>
            <View className="mb-4 flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <Feather name="credit-card" size={18} color="#4f46e5" />
              </View>
              <View>
                <Text className="font-bold text-gray-900">Bank Account Details</Text>
                <Text className="text-[11px] text-gray-500">Where COD collections are settled</Text>
              </View>
            </View>

            <Text className="mb-1 font-bold text-xs text-gray-700">Account Holder Name</Text>
            <TextInput
              value={bankDetails.accountName}
              onChangeText={(v) => setBankDetails((p) => ({ ...p, accountName: v.toUpperCase() }))}
              placeholder="JOHN DOE"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              className="mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
            />

            <Text className="mb-1 font-bold text-xs text-gray-700">Account Number</Text>
            <TextInput
              value={bankDetails.accountNumber}
              onChangeText={(v) =>
                setBankDetails((p) => ({ ...p, accountNumber: v.replace(/[^0-9]/g, '') }))
              }
              placeholder="e.g. 1234567890"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              className="mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
            />

            <Text className="mb-1 font-bold text-xs text-gray-700">IFSC Code</Text>
            <TextInput
              value={bankDetails.ifsc}
              onChangeText={(v) => setBankDetails((p) => ({ ...p, ifsc: v.toUpperCase() }))}
              placeholder="e.g. HDFC0001234"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={11}
              className="mb-5 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
            />

            <TouchableOpacity
              onPress={handleSaveBankDetails}
              disabled={saving}
              activeOpacity={0.8}
              className={`items-center rounded-xl bg-indigo-600 py-3 ${saving ? 'opacity-70' : ''}`}>
              <Text className="font-bold text-white">
                {saving ? 'Saving…' : 'Securely Save Details'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingBottom: insets.bottom + BAR_HEIGHT + 24,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={renderRow}
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'pending' ? 'Nothing pending' : 'No settlements yet'}
              subtitle={
                activeTab === 'pending'
                  ? 'Delivered COD orders awaiting payout will appear here.'
                  : 'Completed COD payouts will appear here.'
              }
            />
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}
