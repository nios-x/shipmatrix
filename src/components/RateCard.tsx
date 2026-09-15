import React, { useEffect, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CourierLogo } from './CourierLogo';
import { Badge } from './ui/Badge';
import { Price } from './ui/Price';
import { Text } from './ui/Text';
import { formatRate } from '../lib/format';
import type { RateResult } from '../lib/rates';

/**
 * One courier quote. Shared by the rate calculator's results and the booking
 * flow's courier step, which had drifted into two near-identical copies.
 *
 * Reading order is the decision order: who (courier), how fast, what it costs,
 * then the action. Price is the heaviest thing on the card; the button is
 * prominent but smaller, so the eye lands on the number before the CTA.
 */

/** Air services are named as such by the server ("Delhivery Air"). */
export const isAirService = (rate: Pick<RateResult, 'carrier_name'>) =>
  rate.carrier_name.toLowerCase().includes('air');

export function RateCard({
  rate,
  isCheapest,
  isFastest,
  onPress,
  disabled,
}: {
  rate: RateResult;
  isCheapest: boolean;
  isFastest: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const air = isAirService(rate);
  const days = rate.estimated_days || 3;

  // Two badges at most: the service mode, plus whichever of the rest matters
  // most. ESTIMATE outranks the superlatives because it changes whether the
  // rate can be booked at all, not just how it compares to the others.
  const tag = rate.estimated ? 'estimate' : isCheapest ? 'cheapest' : isFastest ? 'fastest' : null;

  return (
    <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white px-4 pb-3.5 pt-4">
      <View className="flex-row items-start">
        <CourierLogo name={rate.carrier_name} />

        <View className="ml-3 mr-3 flex-1">
          <Text variant="cardTitle" numberOfLines={2}>
            {rate.carrier_name}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Feather name="clock" size={12} color="#64748B" />
            <Text variant="meta" className="ml-1" numberOfLines={1}>
              Est. {days} business {days === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        <Price amount={rate.freight_charge} caption="All-inclusive" />
      </View>

      <View className="mt-3 flex-row flex-wrap gap-1.5">
        <Badge
          tone={air ? 'info' : 'neutral'}
          icon={air ? 'send' : 'truck'}
          label={air ? 'Air Express' : 'Surface'}
        />
        {tag === 'cheapest' && <Badge tone="positive" icon="trending-down" label="Cheapest" />}
        {tag === 'fastest' && <Badge tone="brand" icon="zap" label="Fastest" />}
        {/* Priced from the server's local list, with no courier account
            behind it. Marked on the card as well as blocked on tap: finding
            out only after choosing a courier is what made this read as a
            courier outage. */}
        {tag === 'estimate' && <Badge tone="warning" icon="info" label="Estimate" />}
      </View>

      <View className="mt-3.5 flex-row items-center justify-between border-t border-slate-100 pt-3">
        <View className="mr-3 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Feather name="shield" size={12} color="#059669" />
            <Text variant="meta">Insured</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Feather name="check" size={12} color="#059669" />
            <Text variant="meta">Free pickup</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Ship with ${rate.carrier_name} for ${formatRate(rate.freight_charge)}`}
          hitSlop={{ top: 4, bottom: 4 }}
          className={`h-10 flex-row items-center justify-center gap-1.5 rounded-xl px-4 ${
            rate.estimated ? 'border border-slate-200 bg-white' : 'bg-violet-600'
          } ${disabled ? 'opacity-60' : ''}`}>
          <Text
            variant="button"
            className={`text-[13px] ${rate.estimated ? 'text-slate-700' : 'text-white'}`}>
            Ship Now
          </Text>
          <Feather name="arrow-right" size={14} color={rate.estimated ? '#334155' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Placeholder shaped like a `RateCard`, so the list does not jump when quotes
 * land. A single slow pulse: loading should read as waiting, not as activity.
 */
export function RateCardSkeleton({ count = 3 }: { count?: number }) {
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessibilityLabel="Loading courier rates" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <Animated.View key={i} style={{ opacity: pulse }}>
          <View className="mb-3 rounded-2xl border border-slate-200/80 bg-white px-4 pb-3.5 pt-4">
            <View className="flex-row items-start">
              <View className="h-10 w-12 rounded-xl bg-slate-100" />
              <View className="ml-3 flex-1 gap-2 pt-0.5">
                <View className="h-3.5 w-3/4 rounded bg-slate-100" />
                <View className="h-3 w-1/2 rounded bg-slate-100" />
              </View>
              <View className="items-end gap-2 pt-0.5">
                <View className="h-6 w-16 rounded bg-slate-100" />
                <View className="h-2.5 w-14 rounded bg-slate-100" />
              </View>
            </View>
            <View className="mt-3 h-6 w-24 rounded-md bg-slate-100" />
            <View className="mt-3.5 flex-row items-center justify-between border-t border-slate-100 pt-3">
              <View className="h-3 w-32 rounded bg-slate-100" />
              <View className="h-10 w-28 rounded-xl bg-slate-100" />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
