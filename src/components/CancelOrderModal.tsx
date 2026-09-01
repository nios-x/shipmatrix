import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CANCEL_REASONS } from '../lib/cancelOrder';

interface CancelOrderModalProps {
  awb?: string;
  /** Amount returning to the wallet, so the sheet can state it before the tap. */
  refund: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Asks for a cancellation reason before releasing an AWB.
 *
 * The reason is mandatory: three of the courier APIs forward it as their
 * cancellation remark, and the confirmation step is what keeps a stray tap on
 * a destructive, chargeable action from going through.
 *
 * Mounted only while the sheet is open, so each cancellation starts with no
 * reason selected instead of inheriting the last one — a stale selection would
 * let a single tap confirm something the user never read.
 */
export function CancelOrderModal({
  awb,
  refund,
  submitting,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState('');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={submitting ? undefined : onClose}>
      <View className="flex-1 bg-black/60 items-center justify-center px-6">
        <View
          className="w-full max-w-sm bg-white rounded-[28px] p-6 border border-slate-100"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.12,
            shadowRadius: 28,
            elevation: 12,
          }}
        >
          <View className="items-center mb-3">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center border border-rose-100"
              style={{ backgroundColor: '#fff1f2' }}
            >
              <Feather name="x-circle" size={26} color="#e11d48" />
            </View>
          </View>

          <Text className="text-lg font-raleway-black text-slate-900 text-center">
            Cancel Shipment
          </Text>
          <Text className="text-xs font-raleway-medium text-slate-500 text-center mt-1.5 leading-5">
            Why are you cancelling{awb ? ` AWB ${awb}` : ' this order'}?
          </Text>

          <ScrollView
            className="mt-5 mb-4"
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator={false}
          >
            {CANCEL_REASONS.map((option) => {
              const selected = reason === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setReason(option)}
                  activeOpacity={0.7}
                  disabled={submitting}
                  className={`flex-row items-center gap-3 p-3.5 mb-2 rounded-2xl border ${
                    selected ? 'border-violet-500 bg-violet-50' : 'border-slate-100 bg-white'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      selected ? 'border-violet-600' : 'border-slate-300'
                    }`}
                  >
                    {selected && <View className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                  </View>
                  <Text
                    className={`text-sm flex-1 ${
                      selected
                        ? 'font-raleway-bold text-slate-900'
                        : 'font-raleway-semibold text-slate-600'
                    }`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {refund > 0 && (
            <View className="flex-row items-center gap-2 p-3 mb-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <Feather name="corner-down-left" size={14} color="#059669" />
              <Text className="text-xs font-raleway-semibold text-emerald-700 flex-1">
                ₹{refund} returns to your wallet.
              </Text>
            </View>
          )}

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              disabled={submitting}
              className="flex-1 h-12 rounded-2xl bg-slate-100 items-center justify-center"
            >
              <Text className="text-sm font-raleway-bold text-slate-700">Keep Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onConfirm(reason)}
              activeOpacity={0.8}
              disabled={!reason || submitting}
              className={`flex-1 h-12 rounded-2xl items-center justify-center flex-row gap-2 ${
                !reason || submitting ? 'bg-rose-300' : 'bg-rose-600'
              }`}
            >
              {submitting && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text className="text-sm font-raleway-bold text-white">
                {submitting ? 'Cancelling…' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
