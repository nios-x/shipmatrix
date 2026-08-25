import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Logo } from '../components/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type ViewState = 'login' | 'forgot-password' | 'reset-sent';

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<ViewState>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', userCred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        navigation.navigate('Signup', { fromGoogle: false });
      }
      // Auth state listener in RootNavigator handles the rest
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setView('reset-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      {/* Scrollable content: header, inputs, links */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="justify-center bg-white p-6 mt-12">
          {view === 'login' && (
            <>
              {/* Header */}
              <View className="items-center mb-8 mt-4">
                <View className="bg-purple-100 p-4 rounded-full mb-4">
                  <Logo size={32} />
                </View>
                <Text className="text-2xl font-bold text-gray-900 text-center w-full">
                  Welcome Back
                </Text>
                <Text className="text-gray-500 mt-2 text-center text-sm">
                  Login to manage your shipments
                </Text>
              </View>

              {error ? (
                <View className="bg-red-50 p-3 rounded-xl mb-4">
                  <Text className="text-red-600 text-sm font-medium text-center">
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Email
                </Text>
                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather name="mail" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-2">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Password
                </Text>
                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather name="lock" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-12 py-3 font-medium text-gray-900"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5"
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                onPress={() => { setError(''); setView('forgot-password'); }}
                className="self-end mb-2"
              >
                <Text className="text-sm font-semibold text-purple-600">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'forgot-password' && (
            <>
              <View className="items-center mb-8 mt-4">
                <View className="bg-purple-100 p-4 rounded-full mb-4">
                  <Feather name="key" size={32} color="#7c3aed" />
                </View>
                <Text className="text-2xl font-bold text-gray-900 text-center">
                  Reset Password
                </Text>
                <Text className="text-gray-500 mt-2 text-center text-sm">
                  Enter your email to receive a reset link.
                </Text>
              </View>

              {error ? (
                <View className="bg-red-50 p-3 rounded-xl mb-4">
                  <Text className="text-red-600 text-sm font-medium text-center">
                    {error}
                  </Text>
                </View>
              ) : null}

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Email Address
                </Text>
                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather name="mail" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email used for registration"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>
            </>
          )}

          {view === 'reset-sent' && (
            <View className="items-center mb-8 mt-4">
              <View className="bg-purple-100 p-4 rounded-full mb-4">
                <Feather name="mail" size={32} color="#7c3aed" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center">
                Check Your Email
              </Text>
              <Text className="text-gray-500 mt-2 text-center text-sm">
                We've sent a reset link to{' '}
                <Text className="font-bold text-gray-800">
                  {email || 'your email'}
                </Text>
                .
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: primary button + footer links stay pinned */}
      <View className="px-6 pt-4 pb-6 bg-white border-t border-gray-100">
        {view === 'login' && (
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            className={`w-full bg-purple-900 py-4 rounded-xl flex-row items-center justify-center gap-2 ${loading ? 'opacity-70' : ''
              }`}
          >
            <Text className="text-white font-bold text-base">
              {loading ? 'Signing in...' : 'Login'}
            </Text>
            {!loading && (
              <Feather name="arrow-right" size={16} color="white" />
            )}
          </TouchableOpacity>
        )}

        {view === 'forgot-password' && (
          <>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.8}
              className={`w-full bg-purple-900 py-4 rounded-xl flex-row items-center justify-center gap-2 ${loading ? 'opacity-70' : ''
                }`}
            >
              <Text className="text-white font-bold">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
              <Feather name="arrow-right" size={16} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setError(''); setView('login'); }}
              className="mt-4"
            >
              <Text className="text-center text-sm font-semibold text-gray-500">
                Back to Login
              </Text>
            </TouchableOpacity>
          </>
        )}

        {view === 'reset-sent' && (
          <TouchableOpacity
            onPress={() => setView('login')}
            activeOpacity={0.8}
            className="w-full bg-purple-900 py-4 rounded-xl items-center"
          >
            <Text className="text-white font-bold">Back to Login</Text>
          </TouchableOpacity>
        )}

        {/* Sign up link */}
        <View className="flex-row items-center justify-center mt-6">
          <Text className="text-sm text-gray-600">
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup', {})}>
            <Text className="font-bold text-purple-600">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}