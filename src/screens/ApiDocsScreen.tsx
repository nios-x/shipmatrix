import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '../components/ui/Text';
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
  {
    method: 'POST',
    path: '/shipments/{awb}/cancel',
    desc: 'Cancel booked shipment and release AWB',
  },
  { method: 'POST', path: '/rates', desc: 'Fetch multi-courier real-time freight rates' },
  {
    method: 'GET',
    path: '/shipments/{awb}/label',
    desc: 'Download printable shipping label (PDF)',
  },
  {
    method: 'GET',
    path: '/shipments/{awb}/track',
    desc: 'Live tracking timeline & checkpoint updates',
  },
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
      <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="font-black text-xl tracking-tight text-slate-900">
              API Documentation
            </Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-500">
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
        showsVerticalScrollIndicator={false}>
        {/* API Key Card */}
        <View className="shadow-xs mb-4 rounded-3xl border border-slate-100 bg-white p-5">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Your Secret API Key
            </Text>
            <View className="rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5">
              <Text className="font-bold text-[10px] text-violet-700">Production</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => copyToClipboard(user?.apiKey || '', 'API Key')}
            activeOpacity={0.7}
            className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Text
              className="flex-1 pr-3 font-bold font-mono text-xs text-slate-800"
              numberOfLines={1}>
              {user?.apiKey ? user.apiKey : 'No API key generated yet'}
            </Text>
            <View className="h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Feather name="copy" size={14} color="#64748B" />
            </View>
          </TouchableOpacity>
          <Text className="mt-2 font-medium text-[11px] text-slate-400">
            Pass this key in the{' '}
            <Text className="font-bold font-mono text-slate-600">x-api-key</Text> header for
            authorized requests.
          </Text>
        </View>

        {/* Base URL Card */}
        <View className="shadow-xs mb-5 rounded-3xl border border-slate-100 bg-white p-5">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Base Endpoint URL
            </Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(API_BASE, 'Base URL')}
              className="flex-row items-center gap-1">
              <Feather name="copy" size={12} color="#7C3AED" />
              <Text className="font-bold text-xs text-violet-700">Copy</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3.5">
            <Text className="font-mono font-semibold text-xs text-emerald-400">{API_BASE}</Text>
          </View>
          <Text className="mt-2 font-medium text-[11px] text-slate-400">
            All endpoints require HTTPS and JSON payload format.
          </Text>
        </View>

        {/* Endpoints List Header */}
        <View className="mb-3 flex-row items-center justify-between px-1">
          <Text className="font-bold text-xs uppercase tracking-wider text-slate-400">
            Available Endpoints ({ENDPOINTS.length})
          </Text>
          <Text className="font-bold text-xs text-slate-500">v1.0</Text>
        </View>

        {/* Endpoints Cards */}
        {ENDPOINTS.map((ep, i) => {
          const isGet = ep.method === 'GET';
          return (
            <View
              key={i}
              className="shadow-xs mb-3 rounded-2xl border border-slate-100 bg-white p-4">
              <View className="mb-1.5 flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center gap-2 pr-2">
                  <View
                    className={`rounded-lg border px-2.5 py-1 ${
                      isGet ? 'border-sky-200/80 bg-sky-50' : 'border-emerald-200/80 bg-emerald-50'
                    }`}>
                    <Text
                      className={`font-black text-[10px] tracking-wider ${
                        isGet ? 'text-sky-700' : 'text-emerald-700'
                      }`}>
                      {ep.method}
                    </Text>
                  </View>
                  <Text className="font-bold font-mono text-xs text-slate-900" numberOfLines={1}>
                    {ep.path}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => copyToClipboard(`${API_BASE}${ep.path}`, 'Endpoint URL')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="copy" size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text className="mt-0.5 font-medium text-xs text-slate-500">{ep.desc}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
