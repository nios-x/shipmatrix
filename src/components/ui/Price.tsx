import React from 'react';
import { View } from 'react-native';

import { Text } from './Text';
import { formatRateAmount } from '../../lib/format';

/**
 * A shipping price, set as the headline number.
 *
 * The amount is always a whole rupee rounded up (see `formatRate`), so it
 * never wraps onto a second line and never carries a stray decimal. The ₹ sign
 * is set smaller and quieter than the figure: the number is what gets
 * compared down a list of couriers, the currency is context.
 */

const SIZES = {
  lg: { amount: 'text-[26px] leading-[30px]', symbol: 'text-[17px]' },
  md: { amount: 'text-xl leading-6', symbol: 'text-sm' },
} as const;

export function Price({
  amount,
  size = 'lg',
  caption,
  align = 'right',
}: {
  amount: number;
  size?: keyof typeof SIZES;
  caption?: string;
  align?: 'left' | 'right';
}) {
  const s = SIZES[size];
  return (
    <View className={`shrink-0 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <Text variant="price" className={s.amount} numberOfLines={1}>
        <Text className={`font-semibold text-slate-500 ${s.symbol}`}>₹</Text>
        {formatRateAmount(amount)}
      </Text>
      {caption && (
        <Text variant="meta" className="mt-0.5 text-[11px]">
          {caption}
        </Text>
      )}
    </View>
  );
}
