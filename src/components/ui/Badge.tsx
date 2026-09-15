import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Text } from './Text';

/**
 * A small status or attribute tag.
 *
 * One size, one shape, one type style: several badges sit side by side on a
 * rate card, and when each had its own padding, border and letter case the
 * row read as noise. Tone carries the meaning; the shape never changes.
 */

const TONES = {
  neutral: { box: 'bg-slate-100', text: 'text-slate-700', icon: '#475569' },
  info: { box: 'bg-sky-50', text: 'text-sky-800', icon: '#0369A1' },
  positive: { box: 'bg-emerald-50', text: 'text-emerald-800', icon: '#047857' },
  brand: { box: 'bg-violet-50', text: 'text-violet-800', icon: '#6D28D9' },
  warning: { box: 'bg-amber-50', text: 'text-amber-800', icon: '#B45309' },
  danger: { box: 'bg-rose-50', text: 'text-rose-700', icon: '#BE123C' },
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const t = TONES[tone];
  return (
    <View className={`h-6 flex-row items-center gap-1 self-start rounded-md px-2 ${t.box}`}>
      {icon && <Feather name={icon} size={11} color={t.icon} />}
      <Text className={`font-semibold text-[11px] leading-4 ${t.text}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
