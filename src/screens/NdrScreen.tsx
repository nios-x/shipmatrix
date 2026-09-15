import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, Modal, Linking } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CourierLogo } from '../components/CourierLogo';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
import { api, routes } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isNdr, isRto } from '../lib/shipments';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function NdrScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments, loading } = useShipments();
  const { confirm, confirmDialog } = useConfirm();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTION_REQ' | 'REATTEMPT' | 'RTO'>(
    'ALL'
  );
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [reattemptModalVisible, setReattemptModalVisible] = useState(false);
  const [reattemptInstructions, setReattemptInstructions] = useState('');
  const [reattemptDate, setReattemptDate] = useState('Tomorrow');

  const ndrShipments = shipments.filter((s) => isNdr(s) || isRto(s));

  const handleCallCustomer = (phone: string) => {
    if (!phone) {
      toast.warning('No Phone', 'Customer phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      toast.error('Error', 'Could not initiate phone call.');
    });
  };

  const handleOpenReattempt = (item: any) => {
    setSelectedShipment(item);
    setReattemptInstructions('');
    setReattemptModalVisible(true);
  };

  const [actioning, setActioning] = useState(false);

  /**
   * Records a re-attempt request against the shipment. There is no courier-side
   * re-attempt API, so the instructions are stored on the shipment for the ops
   * team to action — the same place the admin panel reads them from.
   */
  const handleConfirmReattempt = async () => {
    if (!selectedShipment || !auth.currentUser) return;
    setActioning(true);
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/shipments`, selectedShipment.id), {
        ndrAction: 'reattempt',
        ndrInstructions: reattemptInstructions,
        ndrPreferredDate: reattemptDate,
        ndrRequestedAt: serverTimestamp(),
      });
      setReattemptModalVisible(false);
      toast.success(
        'Re-attempt Requested',
        `Delivery re-attempt requested for AWB ${selectedShipment.awb || 'N/A'}.`
      );
    } catch {
      toast.error('Error', 'Could not submit the re-attempt request.');
    } finally {
      setActioning(false);
    }
  };

  const handleRequestRTO = (item: any) => {
    if (!item.awb) {
      toast.warning('No AWB', 'This shipment has no AWB to return.');
      return;
    }

    confirm(
      {
        title: 'Confirm RTO',
        message: `Are you sure you want to return this order (AWB: ${item.awb}) back to your origin address? The delivery will be stopped and return freight will be charged.`,
        confirmText: 'Yes, Return Order',
        destructive: true,
      },
      () => requestRTO(item)
    );
  };

  const requestRTO = async (item: any) => {
    setActioning(true);
    try {
      const res = await api.post(routes.markRto, { awb: item.awb });
      if (res.success) {
        toast.success('RTO Initiated', `Return to Origin initiated for AWB ${item.awb}.`);
      } else {
        toast.error('RTO Failed', res.message || 'Could not initiate the return.');
      }
    } catch (e: any) {
      toast.error('RTO Failed', e.message || 'Could not initiate the return.');
    } finally {
      setActioning(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading NDR Shipments..." />;

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
            <Text className="font-black text-xl tracking-tight text-slate-900">NDR Management</Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-500">
              {ndrShipments.length} non-delivery reports & action requests
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row gap-2 border-b border-slate-100 bg-white px-4 py-3">
        {[
          { id: 'ALL', label: 'All NDR' },
          { id: 'ACTION_REQ', label: 'Action Required' },
          { id: 'REATTEMPT', label: 'Re-attempted' },
          { id: 'RTO', label: 'RTO' },
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
        data={ndrShipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        renderItem={({ item }: { item: any }) => {
          const ndrReason =
            item.ndr_reason ||
            item.exception_reason ||
            'Customer contact number unreachable / Door locked';

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

                <View className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1">
                  <Text className="font-black text-[10px] uppercase text-amber-700">
                    NDR ACTION REQ
                  </Text>
                </View>
              </View>

              {/* NDR Reason Box */}
              <View className="my-3 flex-row items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
                <Feather name="alert-triangle" size={14} color="#D97706" className="mt-0.5" />
                <View className="flex-1">
                  <Text className="font-bold text-[11px] text-amber-950">
                    Courier Delivery Exception
                  </Text>
                  <Text className="mt-0.5 font-medium text-[11px] text-amber-900">{ndrReason}</Text>
                </View>
              </View>

              {/* Customer Info */}
              <View className="flex-row items-center justify-between border-b border-slate-100 py-2">
                <View className="flex-1 pr-3">
                  <Text className="font-bold text-[10px] text-slate-400">CONSIGNEE</Text>
                  <Text className="mt-0.5 font-bold text-xs text-slate-800">
                    {item.customerName || 'Customer'}
                  </Text>
                  {item.deliveryCity && (
                    <Text className="font-medium text-[11px] text-slate-500">
                      {item.deliveryCity}, {item.deliveryPincode}
                    </Text>
                  )}
                </View>

                {item.customerPhone ? (
                  <TouchableOpacity
                    onPress={() => handleCallCustomer(item.customerPhone || '')}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-3 py-1.5">
                    <Feather name="phone-call" size={12} color="#7C3AED" />
                    <Text className="font-bold text-xs text-violet-700">Call Buyer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2.5 pt-3.5">
                <TouchableOpacity
                  onPress={() => handleRequestRTO(item)}
                  disabled={actioning || isRto(item)}
                  activeOpacity={0.8}
                  className={`flex-1 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 py-2.5 ${
                    actioning || isRto(item) ? 'opacity-50' : ''
                  }`}>
                  <Text className="font-black text-xs text-rose-700">
                    {isRto(item) ? 'RTO Started' : 'Request RTO'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenReattempt(item)}
                  activeOpacity={0.8}
                  className="flex-1 items-center justify-center rounded-xl bg-violet-600 py-2.5 shadow-sm shadow-violet-500/20">
                  <Text className="font-black text-xs text-white">Re-attempt</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No NDR Exceptions"
            subtitle="All your shipments are delivering smoothly. No non-delivery reports found."
          />
        }
      />

      {/* Re-attempt Modal */}
      <Modal visible={reattemptModalVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-black text-lg text-slate-900">Schedule Re-attempt</Text>
              <TouchableOpacity onPress={() => setReattemptModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="mb-3 font-medium text-xs text-slate-500">
              Request courier partner to re-attempt delivery with updated instructions or customer
              timing.
            </Text>

            <Text className="mb-1.5 font-bold text-[11px] text-slate-700">Re-attempt Timing</Text>
            <View className="mb-3 flex-row gap-2">
              {['Today', 'Tomorrow', 'Day After'].map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setReattemptDate(d)}
                  className={`rounded-xl border px-3 py-1.5 ${
                    reattemptDate === d
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}>
                  <Text
                    className={`font-bold text-xs ${reattemptDate === d ? 'text-violet-700' : 'text-slate-600'}`}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1.5 font-bold text-[11px] text-slate-700">
              Instructions for Courier Rider
            </Text>
            <TextInput
              value={reattemptInstructions}
              onChangeText={setReattemptInstructions}
              placeholder="e.g. Call customer before arrival, alternate phone: 9876543210"
              placeholderTextColor="#94A3B8"
              multiline
              className="text-top mb-4 min-h-[80px] rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-medium text-xs text-slate-900"
            />

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setReattemptModalVisible(false)}
                className="flex-1 items-center rounded-xl bg-slate-100 py-3">
                <Text className="font-bold text-xs text-slate-700">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmReattempt}
                disabled={actioning}
                className={`flex-1 items-center rounded-xl bg-violet-600 py-3 shadow-sm shadow-violet-500/20 ${
                  actioning ? 'opacity-70' : ''
                }`}>
                <Text className="font-black text-xs text-white">
                  {actioning ? 'Submitting…' : 'Confirm Re-attempt'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {confirmDialog}
    </View>
  );
}
