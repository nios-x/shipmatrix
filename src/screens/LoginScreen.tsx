import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
import { auth } from '../lib/firebase';
import { Logo } from '../components/Logo';
import { GoogleIcon } from '../components/GoogleIcon';
import { useGoogleSignIn, isGoogleSignInConfigured } from '../lib/googleAuth';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type ViewState = 'login' | 'forgot-password' | 'reset-sent';

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<ViewState>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn: googleSignIn } = useGoogleSignIn();

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const res = await googleSignIn();
      if (!res.success && res.error && res.error !== 'Sign in cancelled') {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Mobile keyboards and password managers routinely leave a trailing space on
  // an address. Firebase rejects that outright as auth/invalid-email rather
  // than trimming it, so every call has to be given the cleaned value.
  const trimmedEmail = email.trim();

  const handleLogin = async () => {
    setError('');
    if (!trimmedEmail || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // RootNavigator's auth listener takes it from here — including the case
      // where the profile document is missing, which it repairs itself. This
      // used to check for that and navigate to Signup, which could never run:
      // signing in flips `isAuthenticated`, and the whole Auth stack (this
      // screen included) is unmounted before the navigate lands.
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (err: any) {
      // Firebase's email-enumeration protection — on by default for projects
      // created since late 2023 — reports a missing account and a wrong
      // password as the same auth/invalid-credential, so the copy below cannot
      // narrow it down and the raw code is the only way to tell either from a
      // transport failure. Keep it in `adb logcat -s ReactNativeJS`.
      if (__DEV__) {
        console.warn('[login] sign-in failed', err?.code, err?.message);
      }
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled.');
      } else if (err.code === 'auth/invalid-credential') {
        // An account created through Google has no password credential, so
        // correct-looking details land here too. Only say so where that button
        // exists — pointing at a CTA this build hides would be worse than
        // saying nothing.
        setError(
          isGoogleSignInConfigured
            ? 'Invalid email or password. If you signed up with Google, use Continue with Google instead.'
            : 'Invalid email or password.'
        );
      } else if (err.code === 'auth/invalid-email') {
        setError('That does not look like a valid email address.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('No connection. Check your network and try again.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setView('reset-sent');
    } catch (err: any) {
      // Without this the screen shows raw SDK text ("Firebase: Error
      // (auth/invalid-email).") — the login handler above maps its codes, and
      // this path needs the same treatment.
      if (err.code === 'auth/invalid-email') {
        setError('That does not look like a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again in a few minutes.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('No connection. Check your network and try again.');
      } else {
        setError(err.message || 'Failed to send reset email');
      }
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
        <View className="justify-center bg-white p-6 mt-8">
          {view === 'login' && (
            <>
              {/* Header */}
              <View className="items-center mb-8 mt-2">
                <View className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl items-center justify-center mb-3 shadow-xs">
                  <Logo size={32} />
                </View>
                <Text className="text-2xl font-raleway-bold text-gray-900 text-center tracking-tight">
                  Welcome Back
                </Text>
                <Text className="text-gray-500 mt-1 text-center font-raleway text-sm">
                  Login to manage your shipments
                </Text>
              </View>

              {error ? (
                <View className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl mb-4">
                  <Text className="text-rose-600 text-sm font-raleway text-center">
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Email
                </Text>
                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather name="mail" size={18} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-2">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Password
                </Text>
                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather name="lock" size={18} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    // Revealing the password clears secureTextEntry, and with it
                    // the platform's implicit "leave this text alone" rules: the
                    // field falls back to sentence casing and autocorrect, so a
                    // typed `hunter2` is submitted as `Hunter2`. Sign up with the
                    // eye open and log in with it shut and the two values differ,
                    // which Firebase can only report as auth/invalid-credential.
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="current-password"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-12 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5"
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                onPress={() => { setError(''); setView('forgot-password'); }}
                className="self-end mb-2 pt-1"
              >
                <Text className="text-xs font-raleway-semibold text-purple-600">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </>
          )}

          {view === 'forgot-password' && (
            <>
              <View className="items-center mb-8 mt-2">
                <View className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl items-center justify-center mb-3 shadow-xs">
                  <Feather name="key" size={26} color="#7c3aed" />
                </View>
                <Text className="text-2xl font-raleway-bold text-gray-900 text-center tracking-tight">
                  Reset Password
                </Text>
                <Text className="text-gray-500 mt-1 text-center font-raleway text-sm">
                  Enter your email to receive a reset link.
                </Text>
              </View>

              {error ? (
                <View className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl mb-4">
                  <Text className="text-rose-600 text-sm font-raleway text-center">
                    {error}
                  </Text>
                </View>
              ) : null}

              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Email Address
                </Text>
                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather name="mail" size={18} color="#9ca3af" />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email used for registration"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>
            </>
          )}

          {view === 'reset-sent' && (
            <View className="items-center mb-8 mt-2">
              <View className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl items-center justify-center mb-3 shadow-xs">
                <Feather name="mail" size={26} color="#059669" />
              </View>
              <Text className="text-2xl font-raleway-bold text-gray-900 text-center tracking-tight">
                Check Your Email
              </Text>
              <Text className="text-gray-500 mt-1 text-center font-raleway text-sm">
                If{' '}
                <Text className="font-raleway-bold text-gray-800">
                  {trimmedEmail || 'your email'}
                </Text>{' '}
                has an account with a password, a reset link is on its way.
              </Text>
              {/* This project has Firebase's email enumeration protection on,
                  so the send call reports success for an address that has no
                  account — and for a Google account, which has no password to
                  reset. Neither ever receives a mail, so say so here rather
                  than leaving the user waiting on an inbox. */}
              <Text className="text-gray-400 mt-3 text-center font-raleway text-xs leading-5">
                Nothing after a few minutes? Check your spam folder. If you signed up
                with Google, use “Continue with Google” instead — those accounts have
                no password to reset.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: primary button + footer links stay pinned */}
      <View className="px-6 pt-4 pb-6 bg-white border-t border-gray-100">
        {view === 'login' && (
          <>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
              className={`w-full bg-violet-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''
                }`}
              style={{ elevation: 3 }}
            >
              <Text className="text-white font-raleway-bold text-sm">
                {loading ? 'Signing in...' : 'Login'}
              </Text>
              {!loading && (
                <Feather name="arrow-right" size={16} color="white" />
              )}
            </TouchableOpacity>

            {/* Google is offered only where an OAuth client is actually
                configured; otherwise the button could only ever error out. */}
            {isGoogleSignInConfigured && (
              <>
                <View className="flex-row items-center my-3">
                  <View className="flex-1 h-[1px] bg-gray-200" />
                  <Text className="mx-3 text-[11px] font-raleway-bold text-gray-400 uppercase tracking-wider">
                    OR
                  </Text>
                  <View className="flex-1 h-[1px] bg-gray-200" />
                </View>

                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading}
                  activeOpacity={0.8}
                  className="w-full bg-white border border-gray-200 py-3 rounded-xl flex-row items-center justify-center gap-2.5 shadow-xs"
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#7c3aed" />
                  ) : (
                    <>
                      <GoogleIcon size={18} />
                      <Text className="text-gray-800 font-raleway-bold text-xs">
                        Continue with Google
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {view === 'forgot-password' && (
          <>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.8}
              className={`w-full bg-violet-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''
                }`}
              style={{ elevation: 3 }}
            >
              <Text className="text-white font-raleway-bold text-sm">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
              <Feather name="arrow-right" size={16} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setError(''); setView('login'); }}
              className="mt-3.5"
            >
              <Text className="text-center text-xs font-raleway-semibold text-gray-500">
                Back to Login
              </Text>
            </TouchableOpacity>
          </>
        )}

        {view === 'reset-sent' && (
          <TouchableOpacity
            onPress={() => setView('login')}
            activeOpacity={0.8}
            className="w-full bg-violet-700 py-3.5 rounded-xl items-center shadow-md shadow-purple-900/20"
            style={{ elevation: 3 }}
          >
            <Text className="text-white font-raleway-bold text-sm">Back to Login</Text>
          </TouchableOpacity>
        )}

        {/* Sign up link */}
        <View className="flex-row items-center justify-center mt-5">
          <Text className="text-xs font-raleway text-gray-500">
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text className="font-raleway-bold text-xs text-purple-600">Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}