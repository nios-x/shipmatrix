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
      <View className="w-20 h-20 bg-white rounded-2xl border border-gray-100 items-center justify-center mb-6">
        <Logo size={48} />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-sm text-gray-500 text-center">{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          className="mt-8 bg-purple-900 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
