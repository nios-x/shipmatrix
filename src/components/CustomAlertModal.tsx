import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  buttons?: AlertButton[];
  onClose?: () => void;
}

const TYPE_CONFIG = {
  info: { icon: 'info', iconColor: '#7c3aed', iconBg: '#f5f3ff', border: 'border-purple-100' },
  success: { icon: 'check-circle', iconColor: '#059669', iconBg: '#ecfdf5', border: 'border-emerald-100' },
  warning: { icon: 'alert-triangle', iconColor: '#d97706', iconBg: '#fffbeb', border: 'border-amber-100' },
  error: { icon: 'alert-circle', iconColor: '#e11d48', iconBg: '#fff1f2', border: 'border-rose-100' },
  confirm: { icon: 'help-circle', iconColor: '#7c3aed', iconBg: '#f5f3ff', border: 'border-purple-100' },
};

export function CustomAlertModal({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK' }],
  onClose,
}: CustomAlertProps) {
  if (!visible) return null;

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 items-center justify-center px-6">
        <View
          className="w-full max-w-sm bg-white rounded-3xl p-6 border border-gray-100"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          {/* Icon Badge */}
          <View className="items-center mb-4">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mb-1"
              style={{ backgroundColor: config.iconBg }}
            >
              <Feather name={config.icon as any} size={28} color={config.iconColor} />
            </View>
          </View>

          {/* Title & Message */}
          <Text className="font-geist-bold text-lg text-gray-900 text-center mb-2 tracking-tight">
            {title}
          </Text>
          {message ? (
            <Text className="font-geist text-sm text-gray-500 text-center mb-6 leading-5">
              {message}
            </Text>
          ) : null}

          {/* Actions */}
          <View className="flex-row gap-3">
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = 'bg-purple-900';
              let textStyle = 'text-white font-geist-bold';

              if (isCancel) {
                btnBg = 'bg-gray-100';
                textStyle = 'text-gray-700 font-geist-semibold';
              } else if (isDestructive) {
                btnBg = 'bg-rose-600';
                textStyle = 'text-white font-geist-bold';
              }

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    btn.onPress?.();
                    onClose?.();
                  }}
                  activeOpacity={0.8}
                  className={`flex-1 py-3.5 rounded-xl items-center justify-center ${btnBg}`}
                >
                  <Text className={`text-sm ${textStyle}`}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
