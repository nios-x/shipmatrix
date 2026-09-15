import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatCurrency } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useUser } from '../lib/useUser';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function AdminPanelScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState<'users' | 'complaints'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rulesRejected, setRulesRejected] = useState(false);

  // Hiding the menu entry on the profile screen is not a guard — this screen is
  // still a route, so anything that can navigate reaches it. The real barrier is
  // the Firestore rule on listing `users`; this check exists so a non-admin gets
  // told, instead of watching a spinner resolve into an empty list.
  const isAdmin = user?.role === 'admin';

  // Derived rather than stored, so the refusal needs no setState from an effect
  // — and so a profile that loses the role mid-session closes the screen too.
  const denied = (!userLoading && !isAdmin) || rulesRejected;

  const fetchData = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users')));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      try {
        const compSnap = await getDocs(query(collection(db, 'complaints')));
        setComplaints(compSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // complaints collection might not exist yet
      }
    } catch (e: any) {
      // A rules rejection lands here when the profile claims admin but the
      // database disagrees — the database is the one that counts.
      setRulesRejected(true);
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Waits for the profile, otherwise the first pass always looks unprivileged.
    // Non-admins never fetch at all: the rules would refuse them anyway.
    if (userLoading || !isAdmin) return;
    // Started on the next tick: the fetch reports progress through state, and
    // state set synchronously inside an effect renders twice before paint.
    let active = true;
    const timer = setTimeout(() => {
      if (active) void fetchData();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userLoading, isAdmin]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.companyName?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  if (denied) {
    return (
      <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-5 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text className="font-black text-xl text-gray-900">Admin Panel</Text>
        </View>
        <View className="flex-1 items-center justify-center px-10">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <Feather name="lock" size={26} color="#ef4444" />
          </View>
          <Text className="mb-1.5 font-black text-base text-gray-900">Admins only</Text>
          <Text className="text-center font-medium text-sm leading-5 text-gray-500">
            This account does not have administrator access.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-black text-xl text-gray-900">Admin Panel</Text>
          <Text className="font-medium text-xs text-gray-400">System Administration</Text>
        </View>
        <View className="rounded-full bg-red-100 px-2.5 py-1">
          <Text className="font-black text-[10px] uppercase text-red-600">Superadmin</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="mx-5 mb-4 flex-row rounded-xl bg-gray-100 p-1">
        <TouchableOpacity
          onPress={() => setActiveTab('users')}
          className={`flex-1 items-center rounded-lg py-2.5 ${activeTab === 'users' ? 'bg-white shadow-sm' : ''}`}>
          <Text
            className={`font-bold text-xs ${activeTab === 'users' ? 'text-gray-900' : 'text-gray-500'}`}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('complaints')}
          className={`flex-1 items-center rounded-lg py-2.5 ${activeTab === 'complaints' ? 'bg-white shadow-sm' : ''}`}>
          <Text
            className={`font-bold text-xs ${activeTab === 'complaints' ? 'text-gray-900' : 'text-gray-500'}`}>
            Complaints ({complaints.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="mb-4 px-5">
        <View className="relative">
          <View className="absolute left-3 top-3 z-10">
            <Feather name="search" size={16} color="#9ca3af" />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search users by name, email, company..."
            placeholderTextColor="#9ca3af"
            className="rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 font-medium text-sm text-gray-900"
          />
        </View>
      </View>

      {loading ? (
        <LoadingSpinner message="Loading admin data..." />
      ) : activeTab === 'users' ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingBottom: insets.bottom + BAR_HEIGHT + 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />
          }
          renderItem={({ item }) => (
            <View
              className="mb-3 rounded-2xl border border-gray-100 bg-white p-4"
              style={{ elevation: 1 }}>
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="font-bold text-sm text-gray-900">{item.name || 'Unnamed'}</Text>
                <View
                  className={`rounded px-2 py-0.5 ${item.role === 'admin' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <Text
                    className={`font-bold text-[10px] uppercase ${item.role === 'admin' ? 'text-red-700' : 'text-blue-700'}`}>
                    {item.role || 'user'}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500">{item.email}</Text>
              {item.companyName && (
                <Text className="mt-0.5 text-xs text-gray-400">{item.companyName}</Text>
              )}
              <View className="mt-3 flex-row items-center justify-between border-t border-gray-50 pt-2">
                <Text className="text-xs text-gray-400">Balance</Text>
                <Text className="font-black text-sm text-gray-900">
                  {formatCurrency(item.walletBalance || 0)}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingBottom: insets.bottom + BAR_HEIGHT + 24,
          }}
          renderItem={({ item }) => (
            <View
              className="mb-3 rounded-2xl border border-gray-100 bg-white p-4"
              style={{ elevation: 1 }}>
              <Text className="font-bold text-sm text-gray-900">{item.subject || 'Complaint'}</Text>
              <Text className="mt-1 text-xs text-gray-500">{item.message}</Text>
              {item.adminReply && (
                <View className="mt-2 rounded-lg bg-purple-50 p-2.5">
                  <Text className="font-bold text-xs text-purple-700">
                    Reply: {item.adminReply}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Feather name="inbox" size={40} color="#d1d5db" />
              <Text className="mt-3 font-medium text-gray-400">No complaints</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
