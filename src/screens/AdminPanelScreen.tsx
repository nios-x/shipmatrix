import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

export default function AdminPanelScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'users' | 'complaints'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-black text-gray-900">Admin Panel</Text>
          <Text className="text-xs text-gray-400 font-medium">System Administration</Text>
        </View>
        <View className="bg-red-100 px-2.5 py-1 rounded-full">
          <Text className="text-[10px] font-black text-red-600 uppercase">Superadmin</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row mx-5 mb-4 bg-gray-100 rounded-xl p-1">
        <TouchableOpacity
          onPress={() => setActiveTab('users')}
          className={`flex-1 py-2.5 rounded-lg items-center ${activeTab === 'users' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'users' ? 'text-gray-900' : 'text-gray-500'}`}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('complaints')}
          className={`flex-1 py-2.5 rounded-lg items-center ${activeTab === 'complaints' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'complaints' ? 'text-gray-900' : 'text-gray-500'}`}>
            Complaints ({complaints.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="px-5 mb-4">
        <View className="relative">
          <View className="absolute left-3 top-3 z-10">
            <Feather name="search" size={16} color="#9ca3af" />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search users by name, email, company..."
            placeholderTextColor="#9ca3af"
            className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium text-gray-900"
          />
        </View>
      </View>

      {loading ? (
        <LoadingSpinner message="Loading admin data..." />
      ) : activeTab === 'users' ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-bold text-gray-900 text-sm">{item.name || 'Unnamed'}</Text>
                <View className={`px-2 py-0.5 rounded ${item.role === 'admin' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <Text className={`text-[10px] font-bold uppercase ${item.role === 'admin' ? 'text-red-700' : 'text-blue-700'}`}>
                    {item.role || 'user'}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500">{item.email}</Text>
              {item.companyName && <Text className="text-xs text-gray-400 mt-0.5">{item.companyName}</Text>}
              <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-50">
                <Text className="text-xs text-gray-400">Balance</Text>
                <Text className="text-sm font-black text-gray-900">₹{(item.walletBalance || 0).toFixed(2)}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100" style={{ elevation: 1 }}>
              <Text className="font-bold text-gray-900 text-sm">{item.subject || 'Complaint'}</Text>
              <Text className="text-xs text-gray-500 mt-1">{item.message}</Text>
              {item.adminReply && (
                <View className="bg-purple-50 p-2.5 rounded-lg mt-2">
                  <Text className="text-xs font-bold text-purple-700">Reply: {item.adminReply}</Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Feather name="inbox" size={40} color="#d1d5db" />
              <Text className="text-gray-400 font-medium mt-3">No complaints</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
