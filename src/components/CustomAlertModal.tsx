import React from 'react';
import { View, TouchableOpacity, Modal } from 'react-native';
import { Text } from './ui/Text';
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
  success: {
    icon: 'check-circle',
    iconColor: '#059669',
    iconBg: '#ecfdf5',
    border: 'border-emerald-100',
  },
  warning: {
    icon: 'alert-triangle',
    iconColor: '#d97706',
    iconBg: '#fffbeb',
    border: 'border-amber-100',
  },
  error: {
    icon: 'alert-circle',
    iconColor: '#e11d48',
    iconBg: '#fff1f2',
    border: 'border-rose-100',
  },
  confirm: {
    icon: 'help-circle',
    iconColor: '#7c3aed',
    iconBg: '#f5f3ff',
    border: 'border-purple-100',
  },
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
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View
          className="w-full max-w-sm rounded-[28px] border border-gray-100 bg-white p-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.12,
            shadowRadius: 28,
            elevation: 12,
          }}>
          {/* Icon Badge */}
          <View className="mb-3 items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl border border-gray-100/80"
              style={{ backgroundColor: config.iconBg }}>
              <Feather name={config.icon as any} size={26} color={config.iconColor} />
            </View>
          </View>

          {/* Title & Message */}
          <Text className="mb-1.5 text-center font-raleway-bold text-lg tracking-tight text-gray-900">
            {title}
          </Text>
          {message ? (
            <Text className="mb-6 text-center font-raleway text-sm leading-relaxed text-gray-500">
              {message}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          {/* Actions */}
          <View className="flex-row gap-3">
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = 'bg-violet-700';
              let textStyle = 'text-white font-raleway-bold';

              if (isCancel) {
                btnBg = 'bg-gray-100 border border-gray-200/60';
                textStyle = 'text-gray-700 font-raleway-semibold';
              } else if (isDestructive) {
                btnBg = 'bg-rose-600';
                textStyle = 'text-white font-raleway-bold';
              }

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    btn.onPress?.();
                    onClose?.();
                  }}
                  activeOpacity={0.75}
                  className={`flex-1 items-center justify-center rounded-xl py-3.5 ${btnBg}`}>
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
