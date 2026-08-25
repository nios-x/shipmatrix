import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const channels = [
    { name: 'Shopify', icon: 'shopping-bag', color: '#96bf48', desc: 'Connect your Shopify store' },
    { name: 'WooCommerce', icon: 'globe', color: '#7f54b3', desc: 'Import WooCommerce orders' },
    { name: 'Custom API', icon: 'code', color: '#3b82f6', desc: 'Use our REST API' },
  ];

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Sales Channels</Text>
      </View>
      <ScrollView className="flex-1 px-5">
        {channels.map((ch) => (
          <TouchableOpacity key={ch.name} activeOpacity={0.7} className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 flex-row items-center gap-4" style={{ elevation: 1 }}>
            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: ch.color + '20' }}>
              <Feather name={ch.icon as any} size={24} color={ch.color} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-900">{ch.name}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{ch.desc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
