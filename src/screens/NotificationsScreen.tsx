import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '../lib/useNotifications';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatDateTime } from '../lib/shipments';
import type { Notification } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

const FILTERS = [
  'All',
  'Order Updates',
  'Wallet Alerts',
  'COD Updates',
  'Courier Alerts',
  'System Announcements',
  'Promotions',
];

/** Maps a notification category (or a legacy `type`) to its icon + colour. */
function iconFor(n: Notification): { name: keyof typeof Feather.glyphMap; color: string; bg: string } {
  const category = n.category || '';
  if (category === 'Wallet Alerts' || n.type === 'refund')
    return { name: 'credit-card', color: '#22c55e', bg: '#dcfce7' };
  if (category === 'COD Updates') return { name: 'dollar-sign', color: '#10b981', bg: '#d1fae5' };
  if (category === 'Order Updates' || n.type === 'order')
    return { name: 'package', color: '#8b5cf6', bg: '#ede9fe' };
  if (category === 'Courier Alerts') return { name: 'truck', color: '#3b82f6', bg: '#dbeafe' };
  if (category === 'System Announcements')
    return { name: 'volume-2', color: '#8b5cf6', bg: '#ede9fe' };
  if (category === 'Promotions') return { name: 'tag', color: '#ec4899', bg: '#fce7f3' };
  if (n.type === 'cancel') return { name: 'alert-circle', color: '#ef4444', bg: '#fee2e2' };
  return { name: 'info', color: '#6b7280', bg: '#f3f4f6' };
}

/**
 * Deep-links a notification's `actionLink` (e.g. '/app?tab=wallet') to the
 * matching screen. Unknown targets fall through to no navigation.
 */
const TAB_ROUTES: Record<string, { tab: string; screen?: string }> = {
  wallet: { tab: 'WalletTab' },
  billing: { tab: 'WalletTab', screen: 'Billing' },
  cod: { tab: 'WalletTab', screen: 'CodRemittance' },
  orders: { tab: 'OrdersTab' },
  rates: { tab: 'RatesTab' },
  profile: { tab: 'ProfileTab' },
  ndr: { tab: 'HomeTab', screen: 'Ndr' },
  returns: { tab: 'ProfileTab', screen: 'Returns' },
  tracking: { tab: 'HomeTab', screen: 'Tracking' },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return notifications;
    return notifications.filter((n) => {
      if (n.category === activeFilter) return true;
      // Legacy records predate `category` and only carry a `type`.
      if (activeFilter === 'Order Updates' && n.type === 'cancel') return true;
      if (activeFilter === 'Wallet Alerts' && n.type === 'refund') return true;
      return false;
    });
  }, [notifications, activeFilter]);

  const handleAction = (n: Notification) => {
    markAsRead(n.id);
    const match = n.actionLink?.match(/tab=([^&]+)/);
    const target = match && TAB_ROUTES[match[1].toLowerCase()];
    if (!target) return;
    navigation.navigate('Main', {
      screen: target.tab,
      params: target.screen ? { screen: target.screen } : undefined,
    });
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = iconFor(item);
    return (
      <TouchableOpacity
        activeOpacity={item.actionLink ? 0.7 : 1}
        onPress={() => (item.actionLink ? handleAction(item) : markAsRead(item.id))}
        className={`rounded-2xl p-4 mb-3 border flex-row gap-3 ${
          item.read ? 'bg-white border-gray-100' : 'bg-violet-50/40 border-violet-100'
        }`}
        style={{ elevation: 1 }}
      >
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: icon.bg }}
        >
          <Feather name={icon.name} size={17} color={icon.color} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-sm font-bold text-gray-900 flex-1">{item.title || 'Notification'}</Text>
            {!item.read && <View className="w-2 h-2 rounded-full bg-violet-600 mt-1.5" />}
          </View>

          {!!item.message && (
            <Text className="text-sm text-gray-600 mt-0.5 leading-5">{item.message}</Text>
          )}

          <View className="flex-row items-center gap-2 mt-2">
            {!!item.category && (
              <View className="bg-gray-100 px-1.5 py-0.5 rounded">
                <Text className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
                  {item.category}
                </Text>
              </View>
            )}
            {!!item.createdAt && (
              <Text className="text-[11px] text-gray-400 font-medium">
                {formatDateTime(item.createdAt)}
              </Text>
            )}
          </View>

          {!!item.actionText && !!item.actionLink && (
            <TouchableOpacity
              onPress={() => handleAction(item)}
              activeOpacity={0.8}
              className="mt-3 self-start bg-violet-600 px-4 py-2 rounded-lg"
            >
              <Text className="text-white text-xs font-bold">{item.actionText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading notifications..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900 flex-1">Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
            <Text className="text-xs font-bold text-violet-700">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filters */}
      <View className="mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.7}
                className={`px-4 py-2 rounded-full ${active ? 'bg-violet-100' : 'bg-gray-100'}`}
              >
                <Text
                  className={`text-xs font-bold ${active ? 'text-violet-700' : 'text-gray-600'}`}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            subtitle={
              activeFilter === 'All'
                ? "You're all caught up!"
                : `No ${activeFilter.toLowerCase()} yet.`
            }
          />
        }
      />
    </View>
  );
}
