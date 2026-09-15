import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from './ui/Text';
import { formatCurrency } from '../lib/format';
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
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={submitting ? undefined : onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View
          className="w-full max-w-sm rounded-[28px] border border-slate-100 bg-white p-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.12,
            shadowRadius: 28,
            elevation: 12,
          }}>
          <View className="mb-3 items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl border border-rose-100"
              style={{ backgroundColor: '#fff1f2' }}>
              <Feather name="x-circle" size={26} color="#e11d48" />
            </View>
          </View>

          <Text className="text-center font-raleway-black text-lg text-slate-900">
            Cancel Shipment
          </Text>
          <Text className="mt-1.5 text-center font-raleway-medium text-xs leading-5 text-slate-500">
            Why are you cancelling{awb ? ` AWB ${awb}` : ' this order'}?
          </Text>

          <ScrollView
            className="mb-4 mt-5"
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator={false}>
            {CANCEL_REASONS.map((option) => {
              const selected = reason === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setReason(option)}
                  activeOpacity={0.7}
                  disabled={submitting}
                  className={`mb-2 flex-row items-center gap-3 rounded-2xl border p-3.5 ${
                    selected ? 'border-violet-500 bg-violet-50' : 'border-slate-100 bg-white'
                  }`}>
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-violet-600' : 'border-slate-300'
                    }`}>
                    {selected && <View className="h-2.5 w-2.5 rounded-full bg-violet-600" />}
                  </View>
                  <Text
                    className={`flex-1 text-sm ${
                      selected
                        ? 'font-raleway-bold text-slate-900'
                        : 'font-raleway-semibold text-slate-600'
                    }`}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {refund > 0 && (
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <Feather name="corner-down-left" size={14} color="#059669" />
              <Text className="flex-1 font-raleway-semibold text-xs text-emerald-700">
                {formatCurrency(refund)} returns to your wallet.
              </Text>
            </View>
          )}

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              disabled={submitting}
              className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-100">
              <Text className="font-raleway-bold text-sm text-slate-700">Keep Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onConfirm(reason)}
              activeOpacity={0.8}
              disabled={!reason || submitting}
              className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl ${
                !reason || submitting ? 'bg-rose-300' : 'bg-rose-600'
              }`}>
              {submitting && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text className="font-raleway-bold text-sm text-white">
                {submitting ? 'Cancelling…' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
