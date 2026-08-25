import React from 'react';
import { View, Image, Text } from 'react-native';

function getCourierLogoUrl(name: string): string | null {
  switch (name.toLowerCase()) {
    case 'delhivery air':
    case 'delhivery surface':
    case 'delhivery':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=delhivery.com&sz=128';
    case 'ekart logistics':
    case 'ekart flat':
    case 'ekart':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=ekartlogistics.com&sz=128';
    case 'xpressbees surface':
    case 'xpressbees air':
    case 'xpressbees':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=xpressbees.com&sz=128';
    case 'shadowfax 360':
    case 'shadowfax':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=shadowfax.in&sz=128';
    case 'shree maruti':
    case 'shree maruti air':
    case 'shreemaruti air':
    case 'shreemaruti':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=shreemaruticourier.com&sz=128';
    case 'amazon shipping':
    case 'amazon express':
    case 'amazon':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=amazon.in&sz=128';
    case 'bluedart express':
    case 'bluedart':
    case 'bluedart air':
    case 'bluedart surface':
    case 'bluedart surface lite':
      return 'https://s2.googleusercontent.com/s2/favicons?domain=bluedart.com&sz=128';
    default:
      return null;
  }
}

interface CourierLogoProps {
  name: string;
}

export function CourierLogo({ name }: CourierLogoProps) {
  const logoUrl = getCourierLogoUrl(name);

  if (logoUrl) {
    return (
      <View className="w-14 h-10 rounded items-center justify-center p-1 bg-white border border-gray-100 overflow-hidden">
        <Image
          source={{ uri: logoUrl }}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View className="w-14 h-10 rounded-lg items-center justify-center bg-gray-800">
      <Text className="text-white font-black">{name.charAt(0)}</Text>
    </View>
  );
}
