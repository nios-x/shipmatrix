import React from 'react';
import { View, Text } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';

export const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="w-[92%] bg-white border border-emerald-100 p-4 rounded-2xl flex-row items-center gap-3.5 mt-2"
      style={{
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center border border-emerald-100">
        <Feather name="check-circle" size={20} color="#059669" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-geist-bold text-gray-900 text-sm tracking-tight">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="font-geist text-gray-500 text-xs mt-0.5 leading-4">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  error: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="w-[92%] bg-white border border-rose-100 p-4 rounded-2xl flex-row items-center gap-3.5 mt-2"
      style={{
        shadowColor: '#e11d48',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-xl bg-rose-50 items-center justify-center border border-rose-100">
        <Feather name="alert-circle" size={20} color="#e11d48" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-geist-bold text-gray-900 text-sm tracking-tight">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="font-geist text-gray-500 text-xs mt-0.5 leading-4">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  info: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="w-[92%] bg-white border border-purple-100 p-4 rounded-2xl flex-row items-center gap-3.5 mt-2"
      style={{
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center border border-purple-100">
        <Feather name="info" size={20} color="#7c3aed" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-geist-bold text-gray-900 text-sm tracking-tight">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="font-geist text-gray-500 text-xs mt-0.5 leading-4">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),

  warning: ({ text1, text2 }: BaseToastProps) => (
    <View
      className="w-[92%] bg-white border border-amber-100 p-4 rounded-2xl flex-row items-center gap-3.5 mt-2"
      style={{
        shadowColor: '#d97706',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      }}
    >
      <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center border border-amber-100">
        <Feather name="alert-triangle" size={20} color="#d97706" />
      </View>
      <View className="flex-1">
        {text1 ? (
          <Text className="font-geist-bold text-gray-900 text-sm tracking-tight">{text1}</Text>
        ) : null}
        {text2 ? (
          <Text className="font-geist text-gray-500 text-xs mt-0.5 leading-4">{text2}</Text>
        ) : null}
      </View>
    </View>
  ),
};
