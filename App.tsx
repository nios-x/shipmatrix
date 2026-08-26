import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import Toast from 'react-native-toast-message';
import { View, ActivityIndicator, Text, TextInput, Platform } from 'react-native';
import {
  useFonts,
  Raleway_100Thin,
  Raleway_200ExtraLight,
  Raleway_300Light,
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
  Raleway_700Bold,
  Raleway_800ExtraBold,
  Raleway_900Black,
} from '@expo-google-fonts/raleway';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';

import './global.css';

import { PortalHost } from '@rn-primitives/portal';
import { toastConfig } from './src/components/ToastConfig';

// Inject Raleway font stylesheet dynamically on Web platform
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById('raleway-google-font-link')) {
    const link = document.createElement('link');
    link.id = 'raleway-google-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('raleway-global-font-override')) {
    const style = document.createElement('style');
    style.id = 'raleway-global-font-override';
    style.innerHTML = `
      * {
        font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      }
      body, html, #root, [dir="auto"], [dir] [dir="auto"], div, span, p, h1, h2, h3, h4, h5, h6, input, textarea, button, select {
        font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Enforce Raleway as default font on native components
// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.style = { fontFamily: Platform.OS === 'web' ? 'Raleway' : 'Raleway_400Regular' };

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.style = { fontFamily: Platform.OS === 'web' ? 'Raleway' : 'Raleway_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    Raleway_100Thin,
    Raleway_200ExtraLight,
    Raleway_300Light,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
    Raleway_900Black,
    Raleway: Raleway_400Regular,
    'Raleway-Regular': Raleway_400Regular,
    'Raleway-Medium': Raleway_500Medium,
    'Raleway-SemiBold': Raleway_600SemiBold,
    'Raleway-Bold': Raleway_700Bold,
    'Raleway-ExtraBold': Raleway_800ExtraBold,
    'Raleway-Black': Raleway_900Black,
    'Raleway-Light': Raleway_300Light,
    'Raleway-Thin': Raleway_100Thin,
    // Keep Geist aliases mapped to Raleway for backwards compatibility
    'Geist-Regular': Raleway_400Regular,
    'Geist-Medium': Raleway_500Medium,
    'Geist-SemiBold': Raleway_600SemiBold,
    'Geist-Bold': Raleway_700Bold,
    'Geist-Black': Raleway_900Black,
    'Geist-Light': Raleway_300Light,
    'Geist-Thin': Raleway_100Thin,
  });

  if (!fontsLoaded && Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="dark" />
        <PortalHost />
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </Provider>
  );
}
