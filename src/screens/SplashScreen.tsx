import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Logo } from '../components/Logo';
import { safeGetItem } from '../lib/storage';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

/**
 * Whether the brand animation has already played this process.
 *
 * The Auth stack is unmounted while signed in and rebuilt on sign-out, so
 * without this a logout replays the full three-second splash before Login
 * appears. Module scope, not storage: it is a per-launch fact, and the splash
 * should still play on a cold start.
 */
let splashPlayed = false;

export function hasPlayedSplash(): boolean {
  return splashPlayed;
}

// Brand tokens, matched to the mark and the app chrome.
const VIOLET = '#7C3AED';
const CYAN = '#22D3EE';
const INK = '#1E293B';
const MUTED = '#64748B';

// Numeric fontWeight does not synthesise against a custom family on Android —
// the weight has to come from the family name itself.
const face = (native: string) => ({ fontFamily: Platform.OS === 'web' ? 'Raleway' : native });

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();

  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1Scale = useRef(new Animated.Value(1)).current;
  const dot2Scale = useRef(new Animated.Value(1)).current;
  const dot3Scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo animation
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Text animation
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 800,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Tagline animation
    Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: 1000,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Loader dots
    const createDotAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1.5,
            duration: 500,
            delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    createDotAnimation(dot1Scale, 0).start();
    createDotAnimation(dot2Scale, 200).start();
    createDotAnimation(dot3Scale, 400).start();

    // Navigate after 3s
    const timer = setTimeout(async () => {
      splashPlayed = true;
      const hasOnboarded = await safeGetItem('local', 'hasOnboarded');
      if (hasOnboarded === 'true') {
        navigation.replace('Login');
      } else {
        navigation.replace('Onboarding');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View className="flex-1 items-center justify-center bg-[#FAFAFA]">
      {/* Logo */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          marginBottom: 32,
        }}
      >
        <Logo size={128} />
      </Animated.View>

      {/* Brand name */}
      <Animated.View
        style={{
          opacity: textOpacity,
          flexDirection: 'row',
          alignItems: 'center',
          transform: [
            {
              // Rides the same fade, so the lockup settles as one motion.
              translateY: textOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
      >
        <Text
          style={{
            ...face('Raleway_900Black'),
            fontSize: 40,
            fontWeight: '900',
            color: INK,
            letterSpacing: -1.2,
          }}
        >
          Ship
        </Text>
        <Text
          style={{
            ...face('Raleway_900Black'),
            fontSize: 40,
            fontWeight: '900',
            color: VIOLET,
            letterSpacing: -1.2,
          }}
        >
          Matrix
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text
        style={{
          ...face('Raleway_500Medium'),
          opacity: taglineOpacity,
          position: 'absolute',
          bottom: 100,
          textAlign: 'center',
          color: MUTED,
          fontSize: 13,
          fontWeight: '500',
          paddingHorizontal: 32,
          lineHeight: 20,
          letterSpacing: 0.3,
        }}
      >
        It's time to escape the matrix of logistics.
      </Animated.Text>

      {/* Loading dots */}
      <View
        style={{
          position: 'absolute',
          bottom: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Animated.View
          style={{
            width: 10,
            height: 10,
            backgroundColor: VIOLET,
            borderRadius: 5,
            transform: [{ scale: dot1Scale }],
          }}
        />
        <Animated.View
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'rgba(124,58,237,0.75)',
            borderRadius: 4,
            transform: [{ scale: dot2Scale }],
          }}
        />
        <Animated.View
          style={{
            width: 6,
            height: 6,
            backgroundColor: CYAN,
            borderRadius: 3,
            transform: [{ scale: dot3Scale }],
          }}
        />
      </View>
    </View>
  );
}
