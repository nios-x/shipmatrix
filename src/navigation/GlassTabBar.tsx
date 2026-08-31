import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useBlurTarget } from './BlurTarget';

// ─── Glass tokens ───────────────────────────────────────
const ACCENT = '#7c3aed';
const ACCENT_DEEP = '#4f46e5';
const INACTIVE = '#64748b';

export const BAR_HEIGHT = 62;
const BAR_RADIUS = 26;
const BAR_MARGIN = 14;
const INDICATOR_INSET = 6;

// The bar is positioned absolutely, so it draws *over* screen content rather
// than shrinking it. Every screen inside the tab navigator therefore has to
// reserve BAR_HEIGHT (plus its safe-area inset) at the bottom of its scroll
// content, or its last element ends up under the bar — which is how primary
// actions such as "Get Shipping Rates" became permanently untappable.

const TAB_ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  HomeTab: 'home',
  OrdersTab: 'package',
  RatesTab: 'percent',
  WalletTab: 'credit-card',
  ProfileTab: 'user',
};

const TAB_LABEL_MAP: Record<string, string> = {
  HomeTab: 'Home',
  OrdersTab: 'Orders',
  RatesTab: 'Rates',
  WalletTab: 'Wallet',
  ProfileTab: 'Profile',
};

const webGlass =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      } as any)
    : null;

/**
 * The frosted pane: real blur on native, backdrop-filter on web, with a
 * top-lit gradient sheen and a specular highlight along the upper edge so the
 * surface reads as glass rather than as flat translucent plastic.
 *
 * The tint gradients are deliberately light. Anything heavier than ~0.3 alpha
 * white paints over the blurred backdrop and the bar goes back to looking like
 * frosted plastic — the blur has to stay legible through them.
 */
function GlassSurface() {
  const blurTarget = useBlurTarget();
  // Android needs an explicit blur target; without one expo-blur falls back to
  // `none` (a flat translucent fill) and logs a warning, so only ask for the
  // dimezis method once we actually have a target to sample.
  const androidBlur = Platform.OS === 'android' && blurTarget != null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView
        tint="light"
        intensity={Platform.OS === 'android' ? 85 : 55}
        blurTarget={blurTarget ?? undefined}
        blurMethod={androidBlur ? 'dimezisBlurView' : undefined}
        blurReductionFactor={3}
        style={StyleSheet.absoluteFill}
      />

      {/* Tint + top-down sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.14)', 'rgba(248,250,252,0.10)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Faint violet wash so the bar belongs to the brand */}
      <LinearGradient
        colors={['rgba(124,58,237,0.07)', 'rgba(79,70,229,0.00)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Specular highlight along the top edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topHighlight}
      />
    </View>
  );
}

/** Sliding lozenge that sits behind the focused tab. */
function ActiveIndicator({ style }: { style: any }) {
  return (
    <Animated.View style={[styles.indicator, style]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.45)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(124,58,237,0.20)', 'rgba(79,70,229,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function TabItem({
  routeName,
  focused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const [lift] = useState(() => new Animated.Value(focused ? 1 : 0));
  const [press] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(lift, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    }).start();
  }, [focused, lift]);

  const scale = Animated.multiply(
    lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] })
  );
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() =>
        Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(press, { toValue: 0, useNativeDriver: true, friction: 6 }).start()
      }
      style={styles.tabItem}>
      <Animated.View style={{ transform: [{ translateY }, { scale }], alignItems: 'center' }}>
        <Feather
          name={TAB_ICON_MAP[routeName] || 'circle'}
          size={19}
          color={focused ? ACCENT : INACTIVE}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: focused ? ACCENT : INACTIVE,
              fontFamily:
                Platform.OS === 'web'
                  ? 'Raleway'
                  : focused
                    ? 'Raleway_700Bold'
                    : 'Raleway_600SemiBold',
              fontWeight: focused ? '700' : '600',
            },
          ]}>
          {TAB_LABEL_MAP[routeName] || routeName}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const tabWidth = count > 0 ? barWidth / count : 0;

  const [slide] = useState(() => new Animated.Value(state.index));

  useEffect(() => {
    Animated.spring(slide, {
      toValue: state.index,
      useNativeDriver: true,
      friction: 11,
      tension: 90,
    }).start();
  }, [state.index, slide]);

  const indicatorStyle = useMemo(
    () => ({
      width: Math.max(tabWidth - INDICATOR_INSET * 2, 0),
      opacity: tabWidth > 0 ? 1 : 0,
      transform: [
        {
          // Linear extrapolation carries this across every tab index.
          translateX: slide.interpolate({
            inputRange: [0, 1],
            outputRange: [INDICATOR_INSET, INDICATOR_INSET + tabWidth],
          }),
        },
      ],
    }),
    [slide, tabWidth]
  );

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View
      // Sit just above the home indicator rather than clearing it entirely.
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom - 8, 10) }]}
      pointerEvents="box-none">
      <View style={styles.shadow}>
        <View style={[styles.bar, webGlass]} onLayout={onLayout}>
          <GlassSurface />
          <ActiveIndicator style={indicatorStyle} />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BAR_MARGIN,
  },
  shadow: {
    borderRadius: BAR_RADIUS,
    // Lifted, diffuse shadow — the bar should read as floating above content.
    shadowColor: ACCENT_DEEP,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
    // Android drops the elevation shadow without a backing layer, but keep it
    // faint — the BlurView paints over it, and anything heavier is what shows
    // through if the blur is ever unavailable.
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.22)' : 'transparent',
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.18)' : 'transparent',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: BAR_RADIUS * 0.6,
    right: BAR_RADIUS * 0.6,
    height: 1,
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: BAR_RADIUS - INDICATOR_INSET,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(124,58,237,0.28)',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
});
