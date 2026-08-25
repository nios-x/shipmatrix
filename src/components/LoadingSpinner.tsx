import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({
  message,
  size = 'large',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const content = (
    <View className="items-center justify-center gap-3">
      <ActivityIndicator size={size} color="#7c3aed" />
      {message && (
        <Text className="font-geist-medium text-xs text-gray-500 tracking-wide">{message}</Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f8fafc]">
        {content}
      </View>
    );
  }

  return <View className="py-8 items-center justify-center">{content}</View>;
}
