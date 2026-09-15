import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../lib/useUser';
import { auth, db } from '../lib/firebase';
import { unregisterPushToken } from '../lib/pushNotifications';
import { CustomAlertModal } from '../components/CustomAlertModal';
import { toast } from '../lib/alert';
import { api, ApiError, routes } from '../lib/api';
import type { MainTabParamList } from '../navigation/types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

// Same public form the old website links from Profile > KYC Verification —
// there's no in-app KYC flow yet, so submission still happens on Google's side.
const KYC_FORM_URL =
  'https://docs.google.com/forms/d/1dCgIQofuxRFSbbqGbAhy6rSzMulyLNwjKMBDZqzdhvc/viewform';

const PRIVACY_POLICY_URL = 'https://shipmatrix.in/privacy-policy';

const KYC_BADGE = {
  Approved: { label: 'Verified', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Rejected: { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-700' },
  Pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700' },
} as const;

function getKycBadge(status: string | undefined) {
  if (status && status in KYC_BADGE) return KYC_BADGE[status as keyof typeof KYC_BADGE];
  return { label: 'Not Submitted', bg: 'bg-slate-100', text: 'text-slate-600' };
}

interface MenuItem {
  icon: string;
  label: string;
  color: string;
  screen: string;
  /** Set when the screen lives in another tab's stack, not in ProfileStack. */
  tab?: keyof MainTabParamList;
  highlight?: boolean;
}

const MENU_SECTIONS: { items: MenuItem[] }[] = [
  {
    items: [
      {
        icon: 'shield',
        label: 'Admin Panel',
        color: '#ef4444',
        screen: 'AdminPanel',
        highlight: true,
      },
    ],
  },
  {
    items: [
      { icon: 'settings', label: 'Settings & Preferences', color: '#3b82f6', screen: 'Settings' },
      {
        icon: 'bell',
        label: 'Notifications',
        color: '#ec4899',
        screen: 'Notifications',
        tab: 'HomeTab',
      },
      {
        icon: 'credit-card',
        label: 'Billing & Invoices',
        color: '#22c55e',
        screen: 'Billing',
        tab: 'WalletTab',
      },
      {
        icon: 'dollar-sign',
        label: 'COD Remittance',
        color: '#10b981',
        screen: 'CodRemittance',
        tab: 'WalletTab',
      },
      { icon: 'file-text', label: 'KYC Verification', color: '#f59e0b', screen: 'KycVerification' },
      { icon: 'rotate-ccw', label: 'Returns', color: '#06b6d4', screen: 'Returns' },
      { icon: 'help-circle', label: 'Help & Support', color: '#8b5cf6', screen: 'Support' },
      { icon: 'code', label: 'API Documentation', color: '#f59e0b', screen: 'ApiDocs' },
      { icon: 'shield', label: 'Privacy Policy', color: '#64748b', screen: 'PrivacyPolicy' },
    ],
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, loading } = useUser();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showKycConfirm, setShowKycConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleKycClick = () => {
    if (user?.kycStatus === 'Pending') {
      toast.info('Already Submitted', 'Your KYC is already pending review.');
      return;
    }
    if (user?.kycStatus === 'Approved') {
      toast.success('Already Verified', 'Your KYC is already approved.');
      return;
    }
    Linking.openURL(KYC_FORM_URL).catch(() => {
      toast.error('Could not open form', 'No app on this device can open the link.');
    });
    setShowKycConfirm(true);
  };

  const handleKycConfirm = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        kycUploaded: true,
        kycStatus: 'Pending',
      });
      toast.success('KYC Submitted', 'Waiting for admin approval.');
    } catch {
      toast.error('Submission Failed', 'Please try again.');
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    const uid = auth.currentUser?.uid;
    try {
      // Best-effort, and before signOut() — once signed out there is no user
      // to scope the delete to, and a stale token just means a wasted push.
      if (uid) await unregisterPushToken(uid);
      await auth.signOut();
      toast.success('Logged Out', 'You have been successfully signed out.');
    } catch {
      toast.error('Logout Failed', 'Please try again.');
    }
  };

  // Screens outside ProfileStack must be addressed through their own tab —
  // a bare navigate() by name never reaches a sibling stack.
  const navigateTo = (item: MenuItem) => {
    if (item.screen === 'PrivacyPolicy') {
      Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
        toast.error('Could Not Open Link', 'No app on this device can open the link.');
      });
      return;
    }
    if (item.tab) {
      navigation.navigate(item.tab, { screen: item.screen });
    } else {
      navigation.navigate(item.screen);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.post(routes.deleteAccount, {});
      await auth.signOut();
      toast.success('Account Deleted', 'Your account and personal data have been removed.');
    } catch (e: any) {
      toast.error(
        'Could Not Delete Account',
        e instanceof ApiError ? e.message : 'Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1">
          <Text className="font-black text-xl tracking-tight text-slate-900">Profile</Text>
          <Text className="mt-0.5 font-medium text-xs text-slate-500">
            Manage your account & services
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
          className="h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
          <Feather name="settings" size={16} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="shadow-xs mb-4 flex-row items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-sm shadow-violet-500/25">
            <Text className="font-black text-xl text-white">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            {/* Until the snapshot lands there is nothing to show, and the
                fallbacks read as though the account itself were empty. */}
            <Text className="font-black text-lg tracking-tight text-slate-900">
              {user?.name || (loading ? 'Loading…' : 'User')}
            </Text>
            <Text className="mt-0.5 font-medium text-xs text-slate-400">
              {user?.email || (loading ? '' : 'No email')}
            </Text>
            {user?.companyName && (
              <View className="mt-1 self-start rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5">
                <Text className="font-bold text-[11px] text-violet-700">{user.companyName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, si) => (
          <View
            key={si}
            className="shadow-xs mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white">
            {section.items.map((item, ii) => {
              const isAdmin = item.highlight;
              const isKyc = item.screen === 'KycVerification';
              const showItem = isAdmin ? user?.role === 'admin' : true;
              if (!showItem) return null;

              const kycBadge = isKyc ? getKycBadge(user?.kycStatus) : null;

              return (
                <TouchableOpacity
                  key={ii}
                  onPress={() => (isKyc ? handleKycClick() : navigateTo(item))}
                  activeOpacity={0.7}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    ii < section.items.length - 1 ? 'border-b border-slate-100' : ''
                  }`}>
                  {isAdmin && (
                    <View
                      className="absolute left-0 top-1/2 h-8 w-1 rounded-r-full bg-red-500"
                      style={{ transform: [{ translateY: -16 }] }}
                    />
                  )}
                  <View className="flex-row items-center gap-3.5">
                    <View
                      className="h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: item.color + '15' }}>
                      <Feather name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text className="font-bold text-sm text-slate-800">{item.label}</Text>
                  </View>
                  {kycBadge ? (
                    <View className={`rounded-md px-2 py-0.5 ${kycBadge.bg}`}>
                      <Text className={`font-bold text-[11px] ${kycBadge.text}`}>
                        {kycBadge.label}
                      </Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Logout */}
        <View className="mb-4 overflow-hidden rounded-2xl border border-rose-100 bg-white">
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-center gap-2 bg-rose-50/40 px-5 py-3.5">
            <Feather name="log-out" size={18} color="#E11D48" />
            <Text className="font-bold text-sm text-rose-600">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Account */}
        <TouchableOpacity
          onPress={() => setShowDeleteConfirm(true)}
          activeOpacity={0.6}
          disabled={deleting}
          className="mb-8 items-center">
          <Text className="font-semibold text-xs text-slate-400">
            {deleting ? 'Deleting account…' : 'Delete Account'}
          </Text>
        </TouchableOpacity>
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

      {/* KYC Submission Confirmation Modal */}
      <CustomAlertModal
        visible={showKycConfirm}
        title="Confirm KYC Upload"
        message="Have you successfully filled and submitted the KYC Google Form?"
        type="confirm"
        buttons={[
          { text: 'Not Yet', style: 'cancel' },
          { text: 'Yes, Submitted', onPress: handleKycConfirm },
        ]}
        onClose={() => setShowKycConfirm(false)}
      />

      {/* Delete Account Confirmation Modal */}
      <CustomAlertModal
        visible={showDeleteConfirm}
        title="Delete Account"
        message="This permanently removes your name, email and phone number from ShipMatrix and signs you out. It cannot be undone. Your wallet must be empty first — contact support if you have a remaining balance."
        type="warning"
        buttons={[
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Account', style: 'destructive', onPress: handleDeleteAccount },
        ]}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}
