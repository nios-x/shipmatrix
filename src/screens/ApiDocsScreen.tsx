import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../lib/alert';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

const API_BASE = 'https://www.shipmatrix.in/api/v1';

const ENDPOINTS = [
  { method: 'GET', path: '/orders/{orderId}', desc: 'Get single order details and metadata' },
  { method: 'POST', path: '/shipments', desc: 'Create forward shipment with partner courier' },
  { method: 'POST', path: '/shipments/reverse', desc: 'Create customer return / reverse pickup' },
  { method: 'POST', path: '/shipments/{awb}/cancel', desc: 'Cancel booked shipment and release AWB' },
  { method: 'POST', path: '/rates', desc: 'Fetch multi-courier real-time freight rates' },
  { method: 'GET', path: '/shipments/{awb}/label', desc: 'Download printable shipping label (PDF)' },
  { method: 'GET', path: '/shipments/{awb}/track', desc: 'Live tracking timeline & checkpoint updates' },
  { method: 'GET', path: '/warehouses', desc: 'List registered pickup warehouses' },
  { method: 'POST', path: '/warehouses', desc: 'Add new pickup warehouse address' },
];

export default function ApiDocsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const copyToClipboard = async (text: string, label: string) => {
    if (text) {
      await Clipboard.setStringAsync(text);
      toast.success('Copied to Clipboard', `${label} has been copied.`);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="px-5 pt-4 pb-3.5 bg-white border-b border-slate-100 flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-xl font-black text-slate-900 tracking-tight">
              API Documentation
            </Text>
            <Text className="text-xs text-slate-500 font-medium mt-0.5">
              REST APIs & developer integration keys
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* API Key Card */}
        <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs mb-4">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Your Secret API Key
            </Text>
            <View className="bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
              <Text className="text-[10px] font-bold text-violet-700">Production</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => copyToClipboard(user?.apiKey || '', 'API Key')}
            activeOpacity={0.7}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center justify-between"
          >
            <Text className="text-xs font-mono font-bold text-slate-800 flex-1 pr-3" numberOfLines={1}>
              {user?.apiKey ? user.apiKey : 'No API key generated yet'}
            </Text>
            <View className="w-8 h-8 rounded-xl bg-white border border-slate-200 items-center justify-center">
              <Feather name="copy" size={14} color="#64748B" />
            </View>
          </TouchableOpacity>
          <Text className="text-[11px] text-slate-400 font-medium mt-2">
            Pass this key in the <Text className="font-mono text-slate-600 font-bold">x-api-key</Text> header for authorized requests.
          </Text>
        </View>

        {/* Base URL Card */}
        <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Base Endpoint URL
            </Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(API_BASE, 'Base URL')}
              className="flex-row items-center gap-1"
            >
              <Feather name="copy" size={12} color="#7C3AED" />
              <Text className="text-xs font-bold text-violet-700">Copy</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 flex-row items-center justify-between">
            <Text className="text-emerald-400 text-xs font-mono font-semibold">
              {API_BASE}
            </Text>
          </View>
          <Text className="text-[11px] text-slate-400 font-medium mt-2">
            All endpoints require HTTPS and JSON payload format.
          </Text>
        </View>

        {/* Endpoints List Header */}
        <View className="flex-row items-center justify-between mb-3 px-1">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Available Endpoints ({ENDPOINTS.length})
          </Text>
          <Text className="text-xs font-bold text-slate-500">v1.0</Text>
        </View>

        {/* Endpoints Cards */}
        {ENDPOINTS.map((ep, i) => {
          const isGet = ep.method === 'GET';
          return (
            <View
              key={i}
              className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 shadow-xs"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-2 flex-1 pr-2">
                  <View
                    className={`px-2.5 py-1 rounded-lg border ${
                      isGet
                        ? 'bg-sky-50 border-sky-200/80'
                        : 'bg-emerald-50 border-emerald-200/80'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-black tracking-wider ${
                        isGet ? 'text-sky-700' : 'text-emerald-700'
                      }`}
                    >
                      {ep.method}
                    </Text>
                  </View>
                  <Text className="text-xs font-mono font-bold text-slate-900" numberOfLines={1}>
                    {ep.path}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => copyToClipboard(`${API_BASE}${ep.path}`, 'Endpoint URL')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="copy" size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-slate-500 font-medium mt-0.5">
                {ep.desc}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
