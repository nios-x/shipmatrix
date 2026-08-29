import React from 'react';
import { View, Image, Text } from 'react-native';

/**
 * Brand keyword → favicon domain, checked in order.
 *
 * Matching is on a substring of the normalised name rather than the whole
 * string, because carriers arrive with an open-ended set of service suffixes
 * ("Air", "Surface", "Surface Lite", "360", "Logistics", …). An exact-match
 * table has to be extended every time the server adds a service tier, and
 * silently drops to the initials badge when nobody remembers to — which is how
 * "Shree Maruti Surface" and "Ekart Logistics" lost their logos.
 *
 * `bharat dart` is Blue Dart's brand for the "Ecom Surface Lite" tier, whose
 * label does not otherwise mention Blue Dart.
 */
const BRAND_LOGOS: [pattern: RegExp, domain: string][] = [
  [/delhivery/, 'delhivery.com'],
  [/ekart/, 'ekartlogistics.com'],
  [/xpressbees/, 'xpressbees.com'],
  [/shadowfax/, 'shadowfax.in'],
  [/shree ?maruti/, 'shreemaruticourier.com'],
  [/amazon/, 'amazon.in'],
  [/blue ?dart|bharat ?dart/, 'bluedart.com'],
];

function getCourierLogoUrl(name: string): string | null {
  // Quotes may arrive as a display label ("Shadowfax 360") or, if a caller
  // still passes one through, as a raw carrier id ("shadowfax_360").
  const normalised = (name || '').toLowerCase().replace(/[_-]+/g, ' ');

  for (const [pattern, domain] of BRAND_LOGOS) {
    if (pattern.test(normalised)) {
      return `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=128`;
    }
  }

  return null;
}

interface CourierLogoProps {
  name: string;
}

export function CourierLogo({ name }: CourierLogoProps) {
  const logoUrl = getCourierLogoUrl(name);

  if (logoUrl) {
    return (
      <View
        className="w-12 h-10 rounded-xl items-center justify-center p-1.5 bg-white border border-gray-100 overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        <Image
          source={{ uri: logoUrl }}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      className="w-12 h-10 rounded-xl items-center justify-center bg-slate-900"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <Text className="font-raleway-bold text-white text-xs tracking-wider">
        {name ? name.charAt(0).toUpperCase() : 'C'}
      </Text>
    </View>
  );
}
