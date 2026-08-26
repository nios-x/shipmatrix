import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Logo } from './Logo';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <View
        className="w-20 h-20 bg-white rounded-3xl border border-gray-100 items-center justify-center mb-5"
        style={{
          shadowColor: '#7c3aed',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        <Logo size={44} />
      </View>
      <Text className="font-geist-bold text-lg text-gray-900 mb-1.5 text-center tracking-tight">
        {title}
      </Text>
      {subtitle ? (
        <Text className="font-geist text-sm text-gray-500 text-center leading-relaxed max-w-xs">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          className="mt-6 bg-violet-700 px-6 py-3 rounded-full shadow-md shadow-purple-900/20"
          style={{ elevation: 3 }}
        >
          <Text className="font-geist-bold text-white text-sm">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
