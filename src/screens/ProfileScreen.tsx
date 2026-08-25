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
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View
          className="bg-white rounded-3xl p-5 mt-4 mb-4 flex-row items-center gap-4 border border-gray-100/90"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="w-14 h-14 rounded-2xl bg-purple-900 items-center justify-center shadow-md shadow-purple-900/20">
            <Text className="font-geist-bold text-xl text-white">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-geist-bold text-lg text-gray-900 tracking-tight">
              {user?.name || 'User'}
            </Text>
            <Text className="font-geist text-xs text-gray-500 mt-0.5">
              {user?.email || 'No email'}
            </Text>
            {user?.companyName && (
              <View className="bg-purple-50 px-2 py-0.5 rounded-md mt-1 self-start border border-purple-100/80">
                <Text className="font-geist-semibold text-[11px] text-purple-700">{user.companyName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, si) => (
          <View
            key={si}
            className="bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100/90"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.03,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            {section.items.map((item, ii) => {
              const isAdmin = item.highlight;
              const showItem = isAdmin ? user?.role === 'admin' : true;
              if (!showItem) return null;

              return (
                <TouchableOpacity
                  key={ii}
                  onPress={() => navigateTo(item.screen)}
                  activeOpacity={0.7}
                  className={`px-4 py-3.5 flex-row items-center justify-between ${ii < section.items.length - 1 ? 'border-b border-gray-100/70' : ''
                    }`}
                >
                  {isAdmin && (
                    <View className="absolute left-0 top-1/2 h-8 w-1 bg-red-500 rounded-r-full" style={{ transform: [{ translateY: -16 }] }} />
                  )}
                  <View className="flex-row items-center gap-3.5">
                    <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: item.color + '15' }}>
                      <Feather name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text className="font-geist-medium text-gray-900 text-sm">{item.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Logout */}
        <View className="bg-white border border-rose-100 rounded-2xl mb-8 overflow-hidden">
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.7}
            className="px-5 py-3.5 flex-row items-center justify-center gap-2 bg-rose-50/40"
          >
            <Feather name="log-out" size={18} color="#e11d48" />
            <Text className="font-geist-bold text-rose-600 text-sm">Logout</Text>
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
