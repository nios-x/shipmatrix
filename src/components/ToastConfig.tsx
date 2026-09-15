import React from 'react';
import { View } from 'react-native';
import { Text } from './ui/Text';
import { BaseToastProps } from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';

export const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="mt-2 w-[92%] flex-row items-center gap-3.5 rounded-2xl border border-emerald-100 bg-white p-4"
      style={{
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
        <Feather name="check-circle" size={20} color="#059669" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-raleway-bold text-sm tracking-tight text-gray-900">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="mt-0.5 font-raleway text-xs leading-4 text-gray-500">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  error: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="mt-2 w-[92%] flex-row items-center gap-3.5 rounded-2xl border border-rose-100 bg-white p-4"
      style={{
        shadowColor: '#e11d48',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50">
        <Feather name="alert-circle" size={20} color="#e11d48" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-raleway-bold text-sm tracking-tight text-gray-900">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="mt-0.5 font-raleway text-xs leading-4 text-gray-500">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  info: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="mt-2 w-[92%] flex-row items-center gap-3.5 rounded-2xl border border-purple-100 bg-white p-4"
      style={{
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-purple-100 bg-purple-50">
        <Feather name="info" size={20} color="#7c3aed" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-raleway-bold text-sm tracking-tight text-gray-900">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="mt-0.5 font-raleway text-xs leading-4 text-gray-500">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  warning: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="mt-2 w-[92%] flex-row items-center gap-3.5 rounded-2xl border border-amber-100 bg-white p-4"
      style={{
        shadowColor: '#d97706',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}>
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50">
        <Feather name="alert-triangle" size={20} color="#d97706" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-raleway-bold text-sm tracking-tight text-gray-900">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="mt-0.5 font-raleway text-xs leading-4 text-gray-500">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),
};
