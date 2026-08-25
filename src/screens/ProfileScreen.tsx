import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { auth } from '../lib/firebase';
import { CustomAlertModal } from '../components/CustomAlertModal';
import { toast } from '../lib/alert';

interface MenuItem {
  icon: string;
  label: string;
  color: string;
  screen: string;
  highlight?: boolean;
}

const MENU_SECTIONS: { items: MenuItem[] }[] = [
  {
    items: [
      { icon: 'shield', label: 'Admin Panel', color: '#ef4444', screen: 'AdminPanel', highlight: true },
    ],
  },
  {
    items: [
      { icon: 'user', label: 'Account Settings', color: '#3b82f6', screen: 'Settings' },
      { icon: 'credit-card', label: 'Billing & Invoices', color: '#22c55e', screen: 'Billing' },
      { icon: 'dollar-sign', label: 'COD Remittance', color: '#10b981', screen: 'CodRemittance' },
      { icon: 'bell', label: 'Notifications', color: '#ec4899', screen: 'Notifications' },
      { icon: 'settings', label: 'Settings / Preferences', color: '#6b7280', screen: 'Settings' },
      { icon: 'help-circle', label: 'Help & Support', color: '#8b5cf6', screen: 'Support' },
      { icon: 'code', label: 'API Documentation', color: '#f59e0b', screen: 'ApiDocs' },
      { icon: 'rotate-ccw', label: 'Returns', color: '#06b6d4', screen: 'Returns' },
    ],
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await auth.signOut();
      toast.success('Logged Out', 'You have been successfully signed out.');
    } catch {
      toast.error('Logout Failed', 'Please try again.');
    }
  };

  const navigateTo = (screen: string) => {
    try {
      navigation.navigate(screen);
    } catch {
      toast.info('Coming Soon', 'This feature is under active development.');
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-white  pt-8 mt-4 mb-4 flex-row items-center gap-4" >
          <View className="w-16 h-16 rounded-2xl bg-purple-900 items-center justify-center">
            <Text className="font-geist-bold text-2xl text-white">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-geist-bold text-xl text-gray-900 tracking-tight">
              {user?.name || 'User'}
            </Text>
            <Text className="font-geist text-sm text-gray-500 mt-0.5">
              {user?.email || 'No email'}
            </Text>
            {user?.companyName && (
              <Text className="font-geist-medium text-xs text-purple-600 mt-0.5">{user.companyName}</Text>
            )}
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, si) => (
          <View key={si} className="bg-white  mb-4 overflow-hidden">
            {section.items.map((item, ii) => {
              const isAdmin = item.highlight;
              const showItem = isAdmin ? user?.role === 'admin' : true;
              if (!showItem) return null;

              return (
                <TouchableOpacity
                  key={ii}
                  onPress={() => navigateTo(item.screen)}
                  activeOpacity={0.6}
                  className={`px-3 py-4 flex-row items-center justify-between ${ii < section.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                >
                  {isAdmin && (
                    <View className="absolute left-0 top-1/2 h-8 w-1.5 bg-red-500 rounded-r-full" style={{ transform: [{ translateY: -16 }] }} />
                  )}
                  <View className="flex-row items-center gap-4">
                    <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: item.color + '15' }}>
                      <Feather name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text className="font-geist-medium text-gray-900 text-sm">{item.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9ca3af" />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Logout */}
        <View className="bg-white border border-gray-300 rounded-3xl mb-8 overflow-hidden">
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.6}
            className="px-5 py-4 flex-row items-center justify-center gap-2"
          >
            <Feather name="log-out" size={18} color="#dc2626" />
            <Text className="font-geist-bold text-red-600 text-sm">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Themed Logout Confirmation Modal */}
      <CustomAlertModal
        visible={showLogoutModal}
        title="Confirm Logout"
        message="Are you sure you want to sign out of your account?"
        type="warning"
        buttons={[
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: handleLogout },
        ]}
        onClose={() => setShowLogoutModal(false)}
      />
    </View>
  );
}
