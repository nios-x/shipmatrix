import React, { createContext, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextStyle } from 'react-native';

import { cn } from '../../lib/utils';

/**
 * The app's typography, in one place.
 *
 * Import `Text` and `TextInput` from here, never from `react-native`. Two
 * things go wrong with the bare components, and both showed up on screen:
 *
 * 1. **Fallback font.** A `Text` with no `font-*` class renders in the
 *    platform font (Roboto on Android). `Text.defaultProps` used to paper over
 *    that, but React 19 ignores `defaultProps` on function components, so it
 *    had silently stopped working. These wrappers apply Raleway unless the
 *    caller picks a face.
 *
 * 2. **Old-style figures.** Raleway's default numerals are old-style — the 3,
 *    5 and 9 drop below the baseline — which is lovely in a paragraph and wrong
 *    for prices, AWBs, pincodes and weights. Every string rendered here asks
 *    for lining figures instead. (Raleway has no tabular figures, so columns of
 *    numbers should be right-aligned rather than relying on fixed widths.)
 *
 * Weight comes from the family name (`font-semibold` → Raleway_600SemiBold),
 * never from `fontWeight`: Android cannot synthesise a weight against a
 * single-weight custom font and falls back to Roboto when asked to.
 */

/**
 * Semantic text styles. Reach for these before composing size and weight by
 * hand, so the same role looks the same on every screen.
 */
export const TYPE = {
  /** Screen title in the top app bar. */
  title: 'font-bold text-[20px] leading-[26px] tracking-tight text-slate-900',
  /** A group of content within a screen. */
  heading: 'font-bold text-base leading-[22px] tracking-tight text-slate-900',
  /** Primary line of a card or list row: a courier, a customer. */
  cardTitle: 'font-semibold text-[15px] leading-5 text-slate-900',
  body: 'font-sans text-sm leading-5 text-slate-700',
  /** Secondary line under a title: counts, estimates, timestamps. */
  meta: 'font-medium text-xs leading-4 text-slate-500',
  /** Small uppercase field label. */
  label: 'font-semibold text-[11px] leading-4 uppercase tracking-wider text-slate-500',
  /** A value in a field grid or summary: ₹1,999, 0.5 kg, 14 Sep 2026. */
  value: 'font-semibold text-[15px] leading-5 text-slate-900',
  /** The headline commercial number on a card. */
  price: 'font-bold text-[26px] leading-[30px] tracking-tight text-slate-900',
  /** Button label. */
  button: 'font-semibold text-sm leading-5',
} as const;

export type TextVariant = keyof typeof TYPE;

const LINING_FIGURES: TextStyle = { fontVariant: ['lining-nums'] };

/** Any family or weight utility — they are the same thing in this config. */
const FONT_CLASS = /(^|\s)font-[a-z]/;

/**
 * Lets a caller's `font-*` class replace the base face outright. tailwind-merge
 * cannot do this on its own: to it `font-raleway-bold` and `font-semibold` are
 * unrelated classes, and whichever the generated stylesheet lists later would
 * win regardless of which the caller asked for.
 */
function withBase(base: string, className?: string): string {
  if (!className) return base;
  const stripped = FONT_CLASS.test(className)
    ? base
        .split(/\s+/)
        .filter((c) => !c.startsWith('font-'))
        .join(' ')
    : base;
  return cn(stripped, className);
}

/**
 * A nested `Text` inherits its parent's face and figures on native. Re-applying
 * the base there would reset a bold run inside a sentence back to regular.
 */
const InsideText = createContext(false);

export type TextProps = React.ComponentPropsWithRef<typeof RNText> & {
  className?: string;
  variant?: TextVariant;
};

export function Text({ className, variant, style, children, ...rest }: TextProps) {
  const nested = useContext(InsideText);
  const base = variant ? TYPE[variant] : nested ? '' : 'font-sans';

  return (
    <RNText
      {...rest}
      className={withBase(base, className)}
      style={nested && !variant ? style : [LINING_FIGURES, style]}>
      <InsideText.Provider value>{children}</InsideText.Provider>
    </RNText>
  );
}

export type TextInputProps = React.ComponentPropsWithRef<typeof RNTextInput> & {
  className?: string;
};

export function TextInput({ className, style, ...rest }: TextInputProps) {
  return (
    <RNTextInput
      {...rest}
      className={withBase('font-sans', className)}
      style={[LINING_FIGURES, style]}
    />
  );
}
