import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import Toast from 'react-native-toast-message';
import { View, ActivityIndicator, Text, TextInput, Platform } from 'react-native';
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
} from '@expo-google-fonts/geist';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';

import './global.css';

import { PortalHost } from '@rn-primitives/portal';
import { toastConfig } from './src/components/ToastConfig';

// Inject Geist font stylesheet dynamically on Web platform
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById('geist-google-font-link')) {
    const link = document.createElement('link');
    link.id = 'geist-google-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&family=Geist+Mono:wght@100..900&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('geist-global-font-override')) {
    const style = document.createElement('style');
    style.id = 'geist-global-font-override';
    style.innerHTML = `
      * {
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      }
      body, html, #root, [dir="auto"], [dir] [dir="auto"], div, span, p, h1, h2, h3, h4, h5, h6, input, textarea, button, select {
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Enforce Geist as default font on native components
// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.style = { fontFamily: Platform.OS === 'web' ? 'Geist' : 'Geist-Regular' };

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.style = { fontFamily: Platform.OS === 'web' ? 'Geist' : 'Geist-Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    Geist: require('./assets/fonts/Geist-Regular.otf'),
    'Geist-Regular': require('./assets/fonts/Geist-Regular.otf'),
    'Geist-Medium': require('./assets/fonts/Geist-Medium.otf'),
    'Geist-SemiBold': require('./assets/fonts/Geist-SemiBold.otf'),
    'Geist-Bold': require('./assets/fonts/Geist-Bold.otf'),
    'Geist-Black': require('./assets/fonts/Geist-Black.otf'),
    'Geist-Light': require('./assets/fonts/Geist-Light.otf'),
    'Geist-Thin': require('./assets/fonts/Geist-Thin.otf'),
    'Geist-400': Geist_400Regular,
    'Geist-500': Geist_500Medium,
    'Geist-600': Geist_600SemiBold,
    'Geist-700': Geist_700Bold,
    'Geist-800': Geist_800ExtraBold,
    'Geist-900': Geist_900Black,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
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
