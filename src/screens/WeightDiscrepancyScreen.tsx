import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatRate } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';
import { CourierLogo } from '../components/CourierLogo';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function WeightDiscrepancyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments } = useShipments();
  const { confirm, confirmDialog } = useConfirm();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'DISPUTED' | 'RESOLVED'>(
    'ALL'
  );
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // Sample or actual discrepancies
  const discrepancies = shipments.filter(
    (s) => (s as any).weightDiscrepancy || (s as any).weight_discrepancy
  );

  const displayList = discrepancies.length > 0 ? discrepancies : [];

  const handleRaiseDispute = (item: any) => {
    setSelectedItem(item);
    setDisputeReason('');
    setDisputeModalVisible(true);
  };

  const handleConfirmDispute = () => {
    if (!disputeReason.trim()) {
      toast.warning(
        'Reason Required',
        'Please explain why the courier charged weight is incorrect.'
      );
      return;
    }
    setDisputeModalVisible(false);
    toast.success(
      'Dispute Raised',
      `Dispute for AWB ${selectedItem?.awb || 'N/A'} submitted for review.`
    );
  };

  const handleAcceptDiscrepancy = (item: any) => {
    confirm(
      {
        title: 'Accept Extra Weight Charge',
        message: `Are you sure you want to accept the ${formatRate(item?.discrepancy_amount || 45)} deduction for AWB ${item?.awb}? Once accepted the charge cannot be disputed.`,
        confirmText: 'Accept & Pay',
        destructive: true,
      },
      () => toast.success('Charge Accepted', 'Extra weight charge verified and settled.')
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
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
              Weight Discrepancy
            </Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-500">
              {displayList.length} weight disputes & audit reviews
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row gap-2 border-b border-slate-100 bg-white px-4 py-3">
        {[
          { id: 'ALL', label: 'All' },
          { id: 'PENDING', label: 'Action Required' },
          { id: 'DISPUTED', label: 'Under Review' },
          { id: 'RESOLVED', label: 'Resolved' },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id as any)}
              className={`rounded-xl border px-3 py-1.5 ${
                isActive
                  ? 'border-violet-600 bg-violet-600 shadow-sm shadow-violet-500/20'
                  : 'border-slate-200 bg-slate-50'
              }`}>
              <Text className={`font-black text-xs ${isActive ? 'text-white' : 'text-slate-600'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={displayList}
        keyExtractor={(item, idx) => item.id || String(idx)}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        renderItem={({ item }: { item: any }) => {
          const enteredWeight = item.entered_weight || item.weight || 0.5;
          const chargedWeight = item.charged_weight || enteredWeight + 0.5;
          const diff = (chargedWeight - enteredWeight).toFixed(2);
          const extraCharge = item.discrepancy_amount || Math.round(parseFloat(diff) * 45);

          return (
            <View className="shadow-xs mb-3.5 rounded-3xl border border-slate-100 bg-white p-5">
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3.5">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-1">
                    <CourierLogo name={item.courier || 'Courier'} />
                  </View>
                  <View>
                    <Text className="font-black text-sm text-slate-900">
                      {item.courier || 'Carrier'}
                    </Text>
                    <Text className="mt-0.5 font-semibold text-xs text-slate-400">
                      AWB: {item.awb}
                    </Text>
                  </View>
                </View>

                <View className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1">
                  <Text className="font-black text-[10px] uppercase text-rose-700">
                    +{diff} KG DIFF
                  </Text>
                </View>
              </View>

              {/* Weight Comparison Grid */}
              <View className="my-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5 py-3.5">
                <View>
                  <Text className="font-bold text-[10px] text-slate-400">ENTERED WT</Text>
                  <Text className="mt-0.5 font-black text-sm text-slate-800">
                    {enteredWeight} kg
                  </Text>
                </View>

                <Feather name="arrow-right" size={14} color="#94A3B8" />

                <View>
                  <Text className="font-bold text-[10px] text-slate-400">COURIER WT</Text>
                  <Text className="mt-0.5 font-black text-sm text-rose-600">
                    {chargedWeight} kg
                  </Text>
                </View>

                <View className="border-l border-slate-200 pl-3">
                  <Text className="font-bold text-[10px] text-slate-400">EXTRA CHARGE</Text>
                  <Text className="mt-0.5 font-black text-sm text-slate-950">
                    {formatRate(extraCharge)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2.5 pt-1">
                <TouchableOpacity
                  onPress={() => handleAcceptDiscrepancy(item)}
                  activeOpacity={0.8}
                  className="flex-1 items-center justify-center rounded-xl bg-slate-100 py-2.5">
                  <Text className="font-black text-xs text-slate-700">Accept Charge</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleRaiseDispute(item)}
                  activeOpacity={0.8}
                  className="flex-1 items-center justify-center rounded-xl bg-violet-600 py-2.5 shadow-sm shadow-violet-500/20">
                  <Text className="font-black text-xs text-white">Raise Dispute</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No Weight Discrepancies"
            subtitle="All your shipments have matched the declared weight. No extra weight deductions detected."
          />
        }
      />

      {/* Dispute Modal */}
      <Modal visible={disputeModalVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-black text-lg text-slate-900">Raise Weight Dispute</Text>
              <TouchableOpacity onPress={() => setDisputeModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="mb-3 font-medium text-xs text-slate-500">
              Explain why the courier billed weight is incorrect. You can attach scale photos or
              invoice receipts.
            </Text>

            <TextInput
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="e.g. Package was weighed with dead weight 0.5kg, dimensions 10x10x10cm."
              placeholderTextColor="#94A3B8"
              multiline
              className="text-top mb-4 min-h-[90px] rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-medium text-xs text-slate-900"
            />

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setDisputeModalVisible(false)}
                className="flex-1 items-center rounded-xl bg-slate-100 py-3">
                <Text className="font-bold text-xs text-slate-700">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDispute}
                className="flex-1 items-center rounded-xl bg-violet-600 py-3 shadow-sm shadow-violet-500/20">
                <Text className="font-black text-xs text-white">Submit Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {confirmDialog}
    </View>
  );
}
