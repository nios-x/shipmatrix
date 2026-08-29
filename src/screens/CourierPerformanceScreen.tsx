import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useShipments } from '../lib/useShipments';
import { CourierLogo } from '../components/CourierLogo';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { realShipments, isDelivered, isNdr, isRto, deliveryDays } from '../lib/shipments';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

interface CourierStat {
  name: string;
  total: number;
  delivered: number;
  ndr: number;
  rto: number;
  ndrRate: number;
  deliveryRate: number;
  avgDeliveryDays: number | null;
}

const BAR_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

/** Horizontal bar sized against the largest value in the series. */
function MetricBar({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix: string;
}) {
  // Guard against a zero max so an all-zero series renders empty, not NaN.
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-xs font-semibold text-slate-600">{label}</Text>
        <Text className="text-xs font-black text-slate-900">
          {value}
          {suffix}
        </Text>
      </View>
      <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </View>
    </View>
  );
}

export default function CourierPerformanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { shipments, loading } = useShipments();

  const stats = useMemo<CourierStat[]>(() => {
    const buckets = new Map<string, { total: number; delivered: number; ndr: number; rto: number; days: number[] }>();

    realShipments(shipments).forEach((s) => {
      const courier = s.courierName || s.courier || 'Other';
      if (!buckets.has(courier)) {
        buckets.set(courier, { total: 0, delivered: 0, ndr: 0, rto: 0, days: [] });
      }
      const bucket = buckets.get(courier)!;
      bucket.total += 1;

      if (isNdr(s)) bucket.ndr += 1;
      if (isRto(s)) bucket.rto += 1;
      if (isDelivered(s)) {
        bucket.delivered += 1;
        const days = deliveryDays(s);
        if (days !== null) bucket.days.push(days);
      }
    });

    return [...buckets.entries()]
      .map(([name, b]) => ({
        name,
        total: b.total,
        delivered: b.delivered,
        ndr: b.ndr,
        rto: b.rto,
        ndrRate: b.total > 0 ? Number(((b.ndr / b.total) * 100).toFixed(1)) : 0,
        deliveryRate: b.total > 0 ? Number(((b.delivered / b.total) * 100).toFixed(1)) : 0,
        avgDeliveryDays:
          b.days.length > 0
            ? Number((b.days.reduce((sum, d) => sum + d, 0) / b.days.length).toFixed(1))
            : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [shipments]);

  const maxNdrRate = Math.max(...stats.map((s) => s.ndrRate), 0);
  const maxDeliveryDays = Math.max(...stats.map((s) => s.avgDeliveryDays ?? 0), 0);

  const totals = useMemo(() => {
    const all = realShipments(shipments);
    const delivered = all.filter(isDelivered).length;
    return {
      total: all.length,
      delivered,
      rate: all.length > 0 ? ((delivered / all.length) * 100).toFixed(0) : '0',
    };
  }, [shipments]);

  if (loading) return <LoadingSpinner fullScreen message="Calculating performance..." />;

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Courier Performance</Text>
      </View>

      {stats.length === 0 ? (
        <EmptyState
          title="No data yet"
          subtitle="Performance metrics appear once you've booked some shipments."
        />
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Overall summary */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100" style={{ elevation: 1 }}>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Shipments
              </Text>
              <Text className="text-2xl font-black text-gray-900 mt-1">{totals.total}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100" style={{ elevation: 1 }}>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Delivery Rate
              </Text>
              <Text className="text-2xl font-black text-emerald-600 mt-1">{totals.rate}%</Text>
            </View>
          </View>

          {/* NDR rate comparison */}
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
            <Text className="text-base font-bold text-gray-900 mb-3">NDR Rate by Courier</Text>
            {stats.map((s, i) => (
              <MetricBar
                key={s.name}
                label={s.name}
                value={s.ndrRate}
                max={maxNdrRate}
                color={BAR_COLORS[i % BAR_COLORS.length]}
                suffix="%"
              />
            ))}
            <Text className="text-[11px] text-gray-400 mt-1">Lower is better.</Text>
          </View>

          {/* Avg delivery time */}
          <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-4" style={{ elevation: 1 }}>
            <Text className="text-base font-bold text-gray-900 mb-3">Avg Delivery Time</Text>
            {stats.filter((s) => s.avgDeliveryDays !== null).length === 0 ? (
              <Text className="text-xs text-gray-400 py-2">
                No delivered shipments yet to measure transit time.
              </Text>
            ) : (
              stats
                .filter((s) => s.avgDeliveryDays !== null)
                .map((s, i) => (
                  <MetricBar
                    key={s.name}
                    label={s.name}
                    value={s.avgDeliveryDays as number}
                    max={maxDeliveryDays}
                    color={BAR_COLORS[(i + 1) % BAR_COLORS.length]}
                    suffix=" days"
                  />
                ))
            )}
          </View>

          {/* Per-courier breakdown */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Breakdown
          </Text>
          {stats.map((s) => (
            <View
              key={s.name}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
              style={{ elevation: 1 }}
            >
              <View className="flex-row items-center gap-3 mb-3">
                <CourierLogo name={s.name} />
                <View className="flex-1">
                  <Text className="font-bold text-gray-900">{s.name}</Text>
                  <Text className="text-[11px] text-gray-400">{s.total} shipments</Text>
                </View>
                <Text className="text-sm font-black text-violet-700">{s.deliveryRate}%</Text>
              </View>

              <View className="flex-row justify-between pt-3 border-t border-gray-100">
                {[
                  { label: 'Delivered', value: s.delivered, color: 'text-emerald-600' },
                  { label: 'NDR', value: s.ndr, color: 'text-amber-600' },
                  { label: 'RTO', value: s.rto, color: 'text-red-600' },
                  {
                    label: 'Avg Days',
                    value: s.avgDeliveryDays ?? '—',
                    color: 'text-slate-700',
                  },
                ].map((cell) => (
                  <View key={cell.label} className="items-center flex-1">
                    <Text className={`text-sm font-black ${cell.color}`}>{cell.value}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {cell.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
