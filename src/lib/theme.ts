import { Platform } from 'react-native';

export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 10% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 10% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 10% 3.9%)',
    primary: 'hsl(240 5.9% 10%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 4.8% 95.9%)',
    secondaryForeground: 'hsl(240 5.9% 10%)',
    muted: 'hsl(240 4.8% 95.9%)',
    mutedForeground: 'hsl(240 3.8% 46.1%)',
    accent: 'hsl(240 4.8% 95.9%)',
    accentForeground: 'hsl(240 5.9% 10%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    destructiveForeground: 'hsl(0 0% 98%)',
    border: 'hsl(240 5.9% 90%)',
    input: 'hsl(240 5.9% 90%)',
    ring: 'hsl(240 5.9% 10%)',
    radius: '0.5rem',
  },
  dark: {
    background: 'hsl(240 10% 3.9%)',
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(240 10% 3.9%)',
    cardForeground: 'hsl(0 0% 98%)',
    popover: 'hsl(240 10% 3.9%)',
    popoverForeground: 'hsl(0 0% 98%)',
    primary: 'hsl(0 0% 98%)',
    primaryForeground: 'hsl(240 5.9% 10%)',
    secondary: 'hsl(240 3.7% 15.9%)',
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(240 3.7% 15.9%)',
    mutedForeground: 'hsl(240 5% 64.9%)',
    accent: 'hsl(240 3.7% 15.9%)',
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 62.8% 30.6%)',
    destructiveForeground: 'hsl(0 0% 98%)',
    border: 'hsl(240 3.7% 15.9%)',
    input: 'hsl(240 3.7% 15.9%)',
    ring: 'hsl(240 4.9% 83.9%)',
    radius: '0.5rem',
  },
};

export const NAV_THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    border: 'hsl(240 5.9% 90%)',
    card: 'hsl(0 0% 100%)',
    notification: 'hsl(0 84.2% 60.2%)',
    primary: 'hsl(240 5.9% 10%)',
    text: 'hsl(240 10% 3.9%)',
  },
  dark: {
    background: 'hsl(240 10% 3.9%)',
    border: 'hsl(240 3.7% 15.9%)',
    card: 'hsl(240 10% 3.9%)',
    notification: 'hsl(0 62.8% 30.6%)',
    primary: 'hsl(0 0% 98%)',
    text: 'hsl(0 0% 98%)',
  },
};

const RALEWAY_FACES = {
  regular: ['Raleway_400Regular', '400'],
  medium: ['Raleway_500Medium', '500'],
  semibold: ['Raleway_600SemiBold', '600'],
  bold: ['Raleway_700Bold', '700'],
  extrabold: ['Raleway_800ExtraBold', '800'],
  black: ['Raleway_900Black', '900'],
} as const;

/**
 * Font style for text styled through `style` rather than `className` (animated
 * text, the tab bar). On native the weight must come from the family name
 * alone — pairing a custom family with a bold `fontWeight` makes Android fall
 * back to Roboto — while web has one Raleway font and needs the real weight.
 */
export function fontFace(weight: keyof typeof RALEWAY_FACES) {
  const [family, numeric] = RALEWAY_FACES[weight];
  return Platform.OS === 'web'
    ? { fontFamily: 'Raleway', fontWeight: numeric }
    : { fontFamily: family };
}
