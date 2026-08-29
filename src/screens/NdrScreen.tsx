import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CourierLogo } from '../components/CourierLogo';
import { toast } from '../lib/alert';
import { api } from '../lib/api';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isNdr, isRto } from '../lib/shipments';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function NdrScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments, loading } = useShipments();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTION_REQ' | 'REATTEMPT' | 'RTO'>('ALL');
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
      await updateDoc(
        doc(db, `users/${auth.currentUser.uid}/shipments`, selectedShipment.id),
        {
          ndrAction: 'reattempt',
          ndrInstructions: reattemptInstructions,
          ndrPreferredDate: reattemptDate,
          ndrRequestedAt: serverTimestamp(),
        }
      );
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
    Alert.alert(
      'Confirm RTO',
      `Are you sure you want to return shipment (AWB: ${item.awb}) back to your origin address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request RTO',
          style: 'destructive',
          onPress: async () => {
            if (!item.awb) {
              toast.warning('No AWB', 'This shipment has no AWB to return.');
              return;
            }
            setActioning(true);
            try {
              const res = await api.post('/api/v1/shipments/mark-rto', { awb: item.awb });
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
          },
        },
      ]
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading NDR Shipments..." />;

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
              NDR Management
            </Text>
            <Text className="text-xs text-slate-500 font-medium mt-0.5">
              {ndrShipments.length} non-delivery reports & action requests
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-4 py-3 bg-white border-b border-slate-100 flex-row gap-2">
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
        data={ndrShipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        renderItem={({ item }: { item: any }) => {
          const ndrReason = item.ndr_reason || item.exception_reason || 'Customer contact number unreachable / Door locked';

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

                <View className="bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Text className="text-[10px] font-black text-amber-700 uppercase">
                    NDR ACTION REQ
                  </Text>
                </View>
              </View>

              {/* NDR Reason Box */}
              <View className="bg-amber-50/50 rounded-2xl p-3 my-3 border border-amber-100 flex-row items-start gap-2">
                <Feather name="alert-triangle" size={14} color="#D97706" className="mt-0.5" />
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-amber-950">Courier Delivery Exception</Text>
                  <Text className="text-[11px] font-medium text-amber-900 mt-0.5">{ndrReason}</Text>
                </View>
              </View>

              {/* Customer Info */}
              <View className="py-2 border-b border-slate-100 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[10px] font-bold text-slate-400">CONSIGNEE</Text>
                  <Text className="text-xs font-bold text-slate-800 mt-0.5">{item.customerName || 'Customer'}</Text>
                  {item.deliveryCity && (
                    <Text className="text-[11px] text-slate-500 font-medium">
                      {item.deliveryCity}, {item.deliveryPincode}
                    </Text>
                  )}
                </View>

                {item.customerPhone ? (
                  <TouchableOpacity
                    onPress={() => handleCallCustomer(item.customerPhone || '')}
                    activeOpacity={0.8}
                    className="px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 flex-row items-center gap-1.5"
                  >
                    <Feather name="phone-call" size={12} color="#7C3AED" />
                    <Text className="text-xs font-bold text-violet-700">Call Buyer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2.5 pt-3.5">
                <TouchableOpacity
                  onPress={() => handleRequestRTO(item)}
                  disabled={actioning || isRto(item)}
                  activeOpacity={0.8}
                  className={`flex-1 py-2.5 rounded-xl bg-rose-50 border border-rose-100 items-center justify-center ${
                    actioning || isRto(item) ? 'opacity-50' : ''
                  }`}
                >
                  <Text className="text-xs font-black text-rose-700">
                    {isRto(item) ? 'RTO Started' : 'Request RTO'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenReattempt(item)}
                  activeOpacity={0.8}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 items-center justify-center shadow-sm shadow-violet-500/20"
                >
                  <Text className="text-xs font-black text-white">Re-attempt</Text>
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
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="w-full bg-white rounded-3xl p-6 border border-slate-100 shadow-xl">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-black text-slate-900">Schedule Re-attempt</Text>
              <TouchableOpacity onPress={() => setReattemptModalVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-medium text-slate-500 mb-3">
              Request courier partner to re-attempt delivery with updated instructions or customer timing.
            </Text>

            <Text className="text-[11px] font-bold text-slate-700 mb-1.5">Re-attempt Timing</Text>
            <View className="flex-row gap-2 mb-3">
              {['Today', 'Tomorrow', 'Day After'].map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setReattemptDate(d)}
                  className={`px-3 py-1.5 rounded-xl border ${
                    reattemptDate === d ? 'bg-violet-50 border-violet-600' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text className={`text-xs font-bold ${reattemptDate === d ? 'text-violet-700' : 'text-slate-600'}`}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[11px] font-bold text-slate-700 mb-1.5">Instructions for Courier Rider</Text>
            <TextInput
              value={reattemptInstructions}
              onChangeText={setReattemptInstructions}
              placeholder="e.g. Call customer before arrival, alternate phone: 9876543210"
              placeholderTextColor="#94A3B8"
              multiline
              className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-900 min-h-[80px] mb-4 text-top"
            />

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => setReattemptModalVisible(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
              >
                <Text className="text-xs font-bold text-slate-700">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmReattempt}
                disabled={actioning}
                className={`flex-1 py-3 rounded-xl bg-violet-600 items-center shadow-sm shadow-violet-500/20 ${
                  actioning ? 'opacity-70' : ''
                }`}
              >
                <Text className="text-xs font-black text-white">
                  {actioning ? 'Submitting…' : 'Confirm Re-attempt'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
