import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, type ImageSourcePropType } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * The animated brand mark, once it exists.
 *
 * Until then this is null and every `<Logo>` draws the static SVG below. To
 * switch the animated mark on, add the file under `assets/brand/` and point
 * this at it — nothing else needs to change:
 *
 *   const ANIMATED_LOGO: ImageSourcePropType | null =
 *     require('../../assets/brand/logo-animated.gif');
 *
 * Format notes for whoever exports it:
 * - GIF animates on both platforms (`expo.gif.enabled=true` is already set in
 *   android/gradle.properties). Export on a transparent background so it sits
 *   cleanly on the white app bars and the #FAFAFA splash alike.
 * - Animated WebP is smaller but needs `expo.webp.animated=true` on Android
 *   (+3.4 MB) and does not animate on iOS. Lottie JSON would need
 *   lottie-react-native, which the app does not ship.
 * - Size it at about 3× its largest use (the 128 pt splash → ~384 px) and keep
 *   it under ~300 KB; it is bundled, so it never waits on the network.
 * - Trim the canvas tight to the mark. The component preserves the file's own
 *   aspect ratio, so padding baked into the file shows up as misalignment.
 */
const ANIMATED_LOGO: ImageSourcePropType | null = null;

interface LogoProps {
  /** Height in points. Width follows the mark's aspect ratio. */
  size?: number;
  style?: any;
  /**
   * Plays the animated mark where it is the moment's focus — the splash,
   * onboarding. Leave it off in chrome such as app bars: a mark that keeps
   * moving next to content competes with it. Falls back to the static mark
   * when no animated asset is configured or the user has asked for reduced
   * motion.
   */
  animated?: boolean;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function Logo({ size = 24, style, animated = false }: LogoProps) {
  const reduceMotion = useReduceMotion();

  if (animated && ANIMATED_LOGO && !reduceMotion) {
    const meta = Image.resolveAssetSource(ANIMATED_LOGO);
    const aspect = meta?.width && meta?.height ? meta.width / meta.height : 1;
    return (
      <Image
        source={ANIMATED_LOGO}
        style={[{ height: size, width: size * aspect }, style]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="ShipMatrix"
      />
    );
  }

  return <StaticMark size={size} style={style} />;
}

function StaticMark({ size, style }: { size: number; style?: any }) {
  // Gradient ids must be unique per instance — SVG defs are document-scoped, so
  // two marks on one screen would otherwise share (and fight over) the same id.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const outerId = `sm-outer-${uid}`;
  const innerId = `sm-inner-${uid}`;

  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="ShipMatrix">
      <Defs>
        <LinearGradient id={outerId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#6D28D9" />
          <Stop offset="100%" stopColor="#8B5CF6" />
        </LinearGradient>
        <LinearGradient id={innerId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0891B2" />
          <Stop offset="100%" stopColor="#22D3EE" />
        </LinearGradient>
      </Defs>
      {/* Outer boundary for the play icon */}
      <Path
        d="M26 22C26 14 34 10 41 14L81 39C87 43 87 53 81 57L41 82C34 86 26 82 26 74V22Z"
        stroke={`url(#${outerId})`}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Chevron */}
      <Path
        d="M45 35L62 48L45 61"
        stroke={`url(#${innerId})`}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
