import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';
import { CourierLogo } from '../components/CourierLogo';
import { toast } from '../lib/alert';

export default function WeightDiscrepancyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments } = useShipments();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'DISPUTED' | 'RESOLVED'>('ALL');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // Sample or actual discrepancies
  const discrepancies = shipments.filter((s) => (s as any).weightDiscrepancy || (s as any).weight_discrepancy);

  const displayList = discrepancies.length > 0 ? discrepancies : [];

  const handleRaiseDispute = (item: any) => {
    setSelectedItem(item);
    setDisputeReason('');
    setDisputeModalVisible(true);
  };

  const handleConfirmDispute = () => {
    if (!disputeReason.trim()) {
      toast.warning('Reason Required', 'Please explain why the courier charged weight is incorrect.');
      return;
    }
    setDisputeModalVisible(false);
    toast.success('Dispute Raised', `Dispute for AWB ${selectedItem?.awb || 'N/A'} submitted for review.`);
  };

  const handleAcceptDiscrepancy = (item: any) => {
    Alert.alert(
      'Accept Extra Weight Charge',
      `Accept ₹${item?.discrepancy_amount || 45} deduction for AWB ${item?.awb}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Pay',
          style: 'default',
          onPress: () => toast.success('Charge Accepted', 'Extra weight charge verified and settled.'),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-xl font-black text-slate-900 tracking-tight">
              Weight Discrepancy
            </Text>
            <Text className="text-xs text-slate-500 font-medium mt-0.5">
              {displayList.length} weight disputes & audit reviews
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-4 py-3 bg-white border-b border-slate-100 flex-row gap-2">
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
              className={`px-3 py-1.5 rounded-xl border ${
                isActive
                  ? 'bg-violet-600 border-violet-600 shadow-sm shadow-violet-500/20'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Text
                className={`text-xs font-black ${
                  isActive ? 'text-white' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={displayList}
        keyExtractor={(item, idx) => item.id || String(idx)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }: { item: any }) => {
          const enteredWeight = item.entered_weight || item.weight || 0.5;
          const chargedWeight = item.charged_weight || enteredWeight + 0.5;
          const diff = (chargedWeight - enteredWeight).toFixed(2);
          const extraCharge = item.discrepancy_amount || Math.round(parseFloat(diff) * 45);

          return (
            <View className="bg-white rounded-3xl p-5 mb-3.5 border border-slate-100 shadow-xs">
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3.5 border-b border-slate-100">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-10 h-10 rounded-xl bg-slate-50 items-center justify-center p-1 border border-slate-100">
                    <CourierLogo name={item.courier || 'Courier'} />
                  </View>
                  <View>
                    <Text className="text-sm font-black text-slate-900">{item.courier || 'Carrier'}</Text>
                    <Text className="text-xs text-slate-400 font-semibold mt-0.5">AWB: {item.awb}</Text>
                  </View>
                </View>

                <View className="bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                  <Text className="text-[10px] font-black text-rose-700 uppercase">
                    +{diff} KG DIFF
                  </Text>
                </View>
              </View>

              {/* Weight Comparison Grid */}
              <View className="py-3.5 flex-row items-center justify-between bg-slate-50 rounded-2xl p-3.5 my-3 border border-slate-100">
                <View>
                  <Text className="text-[10px] font-bold text-slate-400">ENTERED WT</Text>
                  <Text className="text-sm font-black text-slate-800 mt-0.5">{enteredWeight} kg</Text>
                </View>

                <Feather name="arrow-right" size={14} color="#94A3B8" />

                <View>
                  <Text className="text-[10px] font-bold text-slate-400">COURIER WT</Text>
                  <Text className="text-sm font-black text-rose-600 mt-0.5">{chargedWeight} kg</Text>
                </View>

                <View className="border-l border-slate-200 pl-3">
                  <Text className="text-[10px] font-bold text-slate-400">EXTRA CHARGE</Text>
                  <Text className="text-sm font-black text-slate-950 mt-0.5">₹{extraCharge}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2.5 pt-1">
                <TouchableOpacity
                  onPress={() => handleAcceptDiscrepancy(item)}
                  activeOpacity={0.8}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 items-center justify-center"
                >
                  <Text className="text-xs font-black text-slate-700">Accept Charge</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleRaiseDispute(item)}
                  activeOpacity={0.8}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 items-center justify-center shadow-sm shadow-violet-500/20"
                >
                  <Text className="text-xs font-black text-white">Raise Dispute</Text>
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
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="w-full bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-black text-slate-900">Raise Weight Dispute</Text>
              <TouchableOpacity onPress={() => setDisputeModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-medium text-slate-500 mb-3">
              Explain why the courier billed weight is incorrect. You can attach scale photos or invoice receipts.
            </Text>

            <TextInput
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="e.g. Package was weighed with dead weight 0.5kg, dimensions 10x10x10cm."
              placeholderTextColor="#94A3B8"
              multiline
              className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-900 min-h-[90px] mb-4 text-top"
            />

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setDisputeModalVisible(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
              >
                <Text className="text-xs font-bold text-slate-700">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmDispute}
                className="flex-1 py-3 rounded-xl bg-violet-600 items-center shadow-sm shadow-violet-500/20"
              >
                <Text className="text-xs font-black text-white">Submit Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
