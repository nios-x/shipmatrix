import React, { useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useNotifications } from '../lib/useNotifications';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatDateTime } from '../lib/shipments';
import { resolveNotificationTarget } from '../lib/notificationRouting';
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
function iconFor(n: Notification): {
  name: keyof typeof Feather.glyphMap;
  color: string;
  bg: string;
} {
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
    const target = resolveNotificationTarget(n.actionLink);
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
        className={`mb-3 flex-row gap-3 rounded-2xl border p-4 ${
          item.read ? 'border-gray-100 bg-white' : 'border-violet-100 bg-violet-50/40'
        }`}
        style={{ elevation: 1 }}>
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: icon.bg }}>
          <Feather name={icon.name} size={17} color={icon.color} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-bold text-sm text-gray-900">
              {item.title || 'Notification'}
            </Text>
            {!item.read && <View className="mt-1.5 h-2 w-2 rounded-full bg-violet-600" />}
          </View>

          {!!item.message && (
            <Text className="mt-0.5 text-sm leading-5 text-gray-600">{item.message}</Text>
          )}

          <View className="mt-2 flex-row items-center gap-2">
            {!!item.category && (
              <View className="rounded bg-gray-100 px-1.5 py-0.5">
                <Text className="font-bold text-[9px] uppercase tracking-wider text-gray-600">
                  {item.category}
                </Text>
              </View>
            )}
            {!!item.createdAt && (
              <Text className="font-medium text-[11px] text-gray-400">
                {formatDateTime(item.createdAt)}
              </Text>
            )}
          </View>

          {!!item.actionText && !!item.actionLink && (
            <TouchableOpacity
              onPress={() => handleAction(item)}
              activeOpacity={0.8}
              className="mt-3 self-start rounded-lg bg-violet-600 px-4 py-2">
              <Text className="font-bold text-xs text-white">{item.actionText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading notifications..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="flex-1 font-black text-xl text-gray-900">Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
            <Text className="font-bold text-xs text-violet-700">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filters */}
      <View className="mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.7}
                className={`rounded-full px-4 py-2 ${active ? 'bg-violet-100' : 'bg-gray-100'}`}>
                <Text
                  className={`font-bold text-xs ${active ? 'text-violet-700' : 'text-gray-600'}`}>
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
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
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
