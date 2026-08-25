import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { EmptyState } from '../components/EmptyState';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Notifications</Text>
      </View>
      <EmptyState title="No notifications" subtitle="You're all caught up!" />
    </View>
  );
}
