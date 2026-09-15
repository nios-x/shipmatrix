import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from './ui/Text';
import { Logo } from './Logo';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    // `flex-1` alone collapses to zero height in an auto-sized parent, which is
    // every caller here: no FlatList in the app sets `flexGrow: 1` on its content
    // container, and some render this straight into a ScrollView. That left the
    // fixed-size logo drawing while the title and subtitle flattened away to
    // nothing. minHeight keeps the block laid out in an unbounded parent; flex-1
    // still centers it when a parent does give it room.
    <View className="flex-1 items-center justify-center p-8" style={{ minHeight: 320 }}>
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-3xl border border-gray-100 bg-white">
        <Logo size={44} />
      </View>
      <Text className="mb-1.5 text-center font-raleway-bold text-lg tracking-tight text-gray-900">
        {title}
      </Text>
      {subtitle ? (
        <Text className="max-w-xs text-center font-raleway text-sm leading-relaxed text-gray-500">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          className="mt-6 rounded-full bg-violet-700 px-6 py-3 shadow-md shadow-purple-900/20"
          style={{ elevation: 3 }}>
          <Text className="font-raleway-bold text-sm text-white">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
