import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { useShipments } from '../lib/useShipments';
import { Logo } from '../components/Logo';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;
function StatusCard({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <LinearGradient
      colors={["#ffffff", "#f8f7ff"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-full border border-violet-100"
      style={{
        borderRadius: 22,
        overflow: "hidden",
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className={`h-2.5 w-2.5 rounded-full ${color}`} />

            <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-gray-500">
              {title}
            </Text>
          </View>

          <View className="rounded-full bg-violet-50 px-2.5 py-1">
            <Text className="text-[9px] font-bold uppercase tracking-wider text-violet-500">
              Status
            </Text>
          </View>
        </View>

        {/* Count */}
        <View className="mt-5 flex-row items-end justify-between">
          <Text className="text-[44px] font-black leading-[48px] tracking-[-2px] text-gray-950">
            {count}
          </Text>

          <Text className="mb-1 text-[11px] font-medium text-gray-400">
            Total
          </Text>
        </View>

        {/* Progress */}
        <View className="mt-5 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <LinearGradient
            colors={["#8b5cf6", "#6366f1", "#06b6d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-full w-[65%] rounded-full"
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function QuickAction({
  title,
  iconName,
  bgColor,
  iconColor,
  onPress,
}: {
  title: string;
  iconName: string;
  bgColor: string;
  iconColor: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center gap-3 w-[80px]"
    >
      <View
        className={`w-16 h-16 rounded-3xl items-center justify-center border border-gray-100 ${bgColor}`}
      >
        <Feather name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text className="text-[11px] font-black text-gray-500 tracking-wider text-center ">
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { shipments, loading } = useShipments();
  const [refreshing, setRefreshing] = useState(false);

  const statusCounts = {
    booked: shipments.filter((s) => s.status?.toUpperCase() === 'BOOKED').length,
    inTransit: shipments.filter((s) =>
      ['IN TRANSIT', 'IN_TRANSIT', 'SHIPPED', 'PICKUP DONE', 'PICKED UP'].includes(
        (s.status || '').toUpperCase()
      )
    ).length,
    delivered: shipments.filter((s) => s.status?.toUpperCase() === 'DELIVERED').length,
    ndr: shipments.filter((s) =>
      ['NDR', 'RTO', 'EXCEPTION', 'UNDELIVERED'].includes(
        (s.status || '').toUpperCase()
      )
    ).length,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Firestore listeners auto-refresh, just add a visual delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Logo size={36} />
          <View>
            <Text className="text-xl font-black text-gray-900 font-extrabold  ">
              ShipMatrix
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
        >
          <Feather name="bell" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Courier Partners Banner */}
      <View className="bg-purple-50 border border-purple-100  p-2 mb-6 overflow-hidden">
        <View className="flex-row items-center justify-evenly">
          {['DELHIVERY', 'XPRESSBEES', 'SHADOWFAX', 'EKART'].map(
            (name, i) => (
              <React.Fragment key={name}>
                <Text className="font-black text-gray-900 text-xs tracking-tighter">
                  {name}
                </Text>
                {i < 3 && (
                  <View className="w-1.5 h-1.5 rounded-full bg-purple-300" />
                )}
              </React.Fragment>
            )
          )}
        </View>
      </View>
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
          />
        }
      >{/* Status Cards */}
        <View className="gap-3 mb-6">
          {/* Row 1 */}
          <View className="flex-row gap-5">
            <View className="flex-1">
              <StatusCard
                title="Booked"
                count={statusCounts.booked}
                color="bg-blue-500"
              />
            </View>

            <View className="flex-1">
              <StatusCard
                title="In Transit"
                count={statusCounts.inTransit}
                color="bg-amber-500"
              />
            </View>
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <StatusCard
                title="Delivered"
                count={statusCounts.delivered}
                color="bg-green-500"
              />
            </View>

            <View className="flex-1">
              <StatusCard
                title="NDR / RTO"
                count={statusCounts.ndr}
                color="bg-red-500"
              />
            </View>
          </View>
        </View>
        {/* Quick Actions */}
     <View className="mb-7">
  <View className="mb-4 flex-row items-center justify-between px-1">
    <Text className="text-xs font-black uppercase tracking-wider text-gray-400">
      Quick Actions
    </Text>

    <Text className="text-[10px] font-bold text-violet-500">
      8 Actions
    </Text>
  </View>

  <View className="flex-row flex-wrap justify-between gap-y-3">
    <QuickAction
      title="Ship Now"
      iconName="send"
      bgColor="bg-purple-50"
      iconColor="#7c3aed"
      onPress={() => {
        (navigation as any).getParent()?.navigate("OrdersTab", {
          screen: "CreateShipment",
        });
      }}
    />

    <QuickAction
      title="Bulk Upload"
      iconName="upload"
      bgColor="bg-pink-50"
      iconColor="#ec4899"
      onPress={() => navigation.navigate("BulkUpload")}
    />

    <QuickAction
      title="B2B Cargo"
      iconName="truck"
      bgColor="bg-amber-50"
      iconColor="#f59e0b"
      onPress={() => navigation.navigate("B2bCargo")}
    />

    <QuickAction
      title="Track"
      iconName="search"
      bgColor="bg-blue-50"
      iconColor="#3b82f6"
      onPress={() => navigation.navigate("Tracking", {})}
    />

    <QuickAction
      title="Returns"
      iconName="rotate-ccw"
      bgColor="bg-emerald-50"
      iconColor="#10b981"
      onPress={() => {
        (navigation as any).getParent()?.navigate("ProfileTab", {
          screen: "Returns",
        });
      }}
    />

    <QuickAction
      title="Weight Dis."
      iconName="sliders"
      bgColor="bg-violet-50"
      iconColor="#7c3aed"
      onPress={() => navigation.navigate("WeightDiscrepancy")}
    />

    <QuickAction
      title="Channels"
      iconName="shopping-cart"
      bgColor="bg-indigo-50"
      iconColor="#6366f1"
      onPress={() => navigation.navigate("Channels")}
    />

    <QuickAction
      title="NDR"
      iconName="alert-circle"
      bgColor="bg-red-50"
      iconColor="#ef4444"
      onPress={() => navigation.navigate("Ndr")}
    />
  </View>
</View>

        {/* Spacer for bottom tab */}
        <View className="h-4" />
      </ScrollView>
    </View>
  );
}
