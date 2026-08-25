import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';

const API_BASE = 'https://www.shipmatrix.in/api/v1';

const ENDPOINTS = [
  { method: 'GET', path: '/orders/{orderId}', desc: 'Get order details' },
  { method: 'POST', path: '/shipments', desc: 'Create a shipment' },
  { method: 'POST', path: '/shipments/reverse', desc: 'Create reverse shipment' },
  { method: 'POST', path: '/shipments/{awb}/cancel', desc: 'Cancel a shipment' },
  { method: 'POST', path: '/rates', desc: 'Get shipping rates' },
  { method: 'GET', path: '/shipments/{awb}/label', desc: 'Download label' },
  { method: 'GET', path: '/shipments/{awb}/track', desc: 'Track shipment' },
  { method: 'GET', path: '/warehouses', desc: 'List warehouses' },
  { method: 'POST', path: '/warehouses', desc: 'Add warehouse' },
];

export default function ApiDocsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useUser();

  const copyApiKey = async () => {
    if (user?.apiKey) {
      await Clipboard.setStringAsync(user.apiKey);
      Toast.show({ type: 'success', text1: 'API Key Copied!' });
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">API Documentation</Text>
      </View>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* API Key */}
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your API Key</Text>
          <TouchableOpacity onPress={copyApiKey} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between">
            <Text className="text-sm font-mono text-gray-700 flex-1" numberOfLines={1}>{user?.apiKey || 'No API key'}</Text>
            <Feather name="copy" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Base URL */}
        <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Base URL</Text>
          <View className="bg-gray-900 rounded-xl px-4 py-3">
            <Text className="text-green-400 text-sm font-mono">{API_BASE}</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-2">Authentication: Bearer JWT token in Authorization header</Text>
        </View>

        {/* Endpoints */}
        <Text className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">Endpoints</Text>
        {ENDPOINTS.map((ep, i) => (
          <View key={i} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
            <View className="flex-row items-center gap-2 mb-1">
              <View className={`px-2 py-0.5 rounded ${ep.method === 'GET' ? 'bg-blue-100' : 'bg-green-100'}`}>
                <Text className={`text-[10px] font-black ${ep.method === 'GET' ? 'text-blue-700' : 'text-green-700'}`}>{ep.method}</Text>
              </View>
              <Text className="text-sm font-mono font-semibold text-gray-900">{ep.path}</Text>
            </View>
            <Text className="text-xs text-gray-500">{ep.desc}</Text>
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
