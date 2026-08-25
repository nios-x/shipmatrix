import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Logo } from '../components/Logo';
import { safeGetItem } from '../lib/storage';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

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
      useNativeDriver: true,
    }).start();

    // Tagline animation
    Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: 1000,
      delay: 500,
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
        style={{ opacity: textOpacity, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text
          style={{
            fontSize: 40,
            fontWeight: '900',
            color: '#1e293b',
            letterSpacing: -1,
          }}
        >
          Ship
        </Text>
        <Text
          style={{
            fontSize: 40,
            fontWeight: '900',
            color: '#1E40AF',
            letterSpacing: -1,
          }}
        >
          Matrix
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text
        style={{
          opacity: taglineOpacity,
          position: 'absolute',
          bottom: 100,
          textAlign: 'center',
          color: '#64748b',
          fontWeight: '500',
          paddingHorizontal: 16,
          letterSpacing: 0.5,
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
            backgroundColor: '#1E40AF',
            borderRadius: 5,
            transform: [{ scale: dot1Scale }],
          }}
        />
        <Animated.View
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'rgba(30,64,175,0.8)',
            borderRadius: 4,
            transform: [{ scale: dot2Scale }],
          }}
        />
        <Animated.View
          style={{
            width: 6,
            height: 6,
            backgroundColor: '#0D9488',
            borderRadius: 3,
            transform: [{ scale: dot3Scale }],
          }}
        />
      </View>
    </View>
  );
}
