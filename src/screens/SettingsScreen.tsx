import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useUser();

  const settings = [
    { key: 'emailNotif', label: 'Email Notifications', icon: 'mail' },
    { key: 'smsNotif', label: 'SMS Notifications', icon: 'message-square' },
    { key: 'pushNotif', label: 'Push Notifications', icon: 'bell' },
    { key: 'autoLabel', label: 'Auto-download Labels', icon: 'download' },
  ];

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Settings</Text>
      </View>
      <View className="mx-5 bg-white rounded-2xl border border-gray-100" style={{ elevation: 1 }}>
        {settings.map((setting, index) => (
          <View key={setting.key} className={`px-5 py-4 flex-row items-center justify-between ${index < settings.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <View className="flex-row items-center gap-3">
              <Feather name={setting.icon as any} size={20} color="#6b7280" />
              <Text className="font-semibold text-gray-900">{setting.label}</Text>
            </View>
            <Switch trackColor={{ true: '#7c3aed', false: '#e5e7eb' }} thumbColor="white" />
          </View>
        ))}
      </View>

      <View className="mx-5 mt-4 bg-white rounded-2xl border border-gray-100 p-5" style={{ elevation: 1 }}>
        <Text className="font-bold text-gray-900 mb-2">Account Info</Text>
        <Text className="text-sm text-gray-500">Email: {user?.email}</Text>
        <Text className="text-sm text-gray-500">Phone: {user?.phone || 'Not set'}</Text>
        <Text className="text-sm text-gray-500">Role: {user?.role}</Text>
        <Text className="text-sm text-gray-500">API Key: {user?.apiKey ? '••••' + user.apiKey.slice(-8) : 'N/A'}</Text>
      </View>
    </View>
  );
}
