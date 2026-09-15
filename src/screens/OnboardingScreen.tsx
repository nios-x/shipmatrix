import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Text } from '../components/ui/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import { Logo } from '../components/Logo';
import { safeSetItem } from '../lib/storage';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

const slides = [
  {
    title: 'Compare prices instantly',
    subtitle: 'Find the best rates among multiple courier partners.',
    icon: 'search',
    color: '#dbeafe',
    iconColor: '#3b82f6',
  },
  {
    title: 'Track all shipments',
    subtitle: 'Real-time updates for you and your customers.',
    icon: 'map',
    color: '#dbeafe',
    iconColor: '#3b82f6',
  },
  {
    title: 'Ship with Top Couriers',
    subtitle: 'Delhivery, XpressBees, Shadowfax & more.',
    icon: 'package',
    color: '#f3e8ff',
    iconColor: '#8b5cf6',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const [currentStep, setCurrentStep] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleComplete = async () => {
    await safeSetItem('local', 'hasOnboarded', 'true');
    navigation.replace('Login');
  };

  const handleNext = () => {
    if (currentStep < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentStep + 1, animated: true });
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const renderSlide = ({ item }: { item: (typeof slides)[0] }) => (
    <View style={{ width }} className="flex-1 items-center justify-center px-8">
      <View
        style={{ backgroundColor: item.color }}
        className="mb-8 h-48 w-48 items-center justify-center rounded-full">
        {currentStep === 0 ? (
          <Logo size={96} animated />
        ) : (
          <Feather name={item.icon as any} size={96} color={item.iconColor} />
        )}
      </View>
      <Text className="mb-2 text-center font-bold text-2xl text-gray-900">{item.title}</Text>
      <Text className="text-center text-gray-500">{item.subtitle}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1">
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          keyExtractor={(_, i) => String(i)}
        />
      </View>

      {/* Bottom section */}
      <View className="items-center gap-6 px-8 pb-12">
        {/* Dots */}
        <View className="flex-row gap-2">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${
                i === currentStep ? 'w-6 bg-violet-700' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </View>

        {/* Buttons */}
        <View className="mt-6 w-full flex-row gap-4">
          {currentStep < slides.length - 1 && (
            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.7}
              className="flex-1 rounded-2xl py-4">
              <Text className="text-center font-bold text-gray-500">Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.8}
            className="flex-[2] flex-row items-center justify-center gap-2 rounded-2xl bg-violet-700 py-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 6,
            }}>
            <Text className="font-bold text-white">
              {currentStep === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Feather name="chevron-right" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
