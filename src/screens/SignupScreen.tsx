import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import {
  signInWithCustomToken,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Logo } from '../components/Logo';
import { GoogleIcon } from '../components/GoogleIcon';
import { useGoogleSignIn, isGoogleSignInConfigured } from '../lib/googleAuth';
import { sendOtp, registerWithOtp } from '../lib/otp';
import { checkEmail } from '../lib/inputs';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

/** Digits in an emailed code, as the payments server generates them. */
const OTP_LENGTH = 6;

export default function SignupScreen() {
  const navigation = useNavigation<Nav>();

  const [step, setStep] = useState(1);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    companyName: '',
    gstNo: '',
    noOfOrders: '0-50',
    companyType: 'B2C',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: proof that the address the account will be created under is one
  // this person can actually read.
  const [otpCode, setOtpCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError('');
  };

  const handleContinue = () => {
    setError('');

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password
    ) {
      setError('Please fill in all required fields');
      return;
    }

    // The server's zod schema is the authority on the address, but it only
    // sees it at step 2 when the code is sent — two screens on from the field
    // that caused it, and behind a generic "Invalid request body." Checking
    // the shape here fails on the input the user can still see.
    const emailError = checkEmail(formData.email);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    setStep(2);
  };

  /**
   * Step 2 no longer creates the account: it emails a code first.
   *
   * The Firebase user is only created once that code comes back verified, so a
   * mistyped address fails here rather than becoming an account nobody can
   * recover.
   */
  const handleSendOtp = async () => {
    setError('');

    if (!formData.companyName.trim()) {
      setError('Please enter your company name');
      return;
    }

    setLoading(true);

    try {
      const { resendAfterSeconds } = await sendOtp(formData.email, 'signup');
      setOtpCode('');
      setResendIn(resendAfterSeconds);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Could not send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    setError('');

    try {
      const { resendAfterSeconds } = await sendOtp(formData.email, 'signup');
      setResendIn(resendAfterSeconds);
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code.');
    }
  };

  const handleVerifyAndSignup = async () => {
    setError('');

    // The server issues six digits, so anything shorter is a half-typed field
    // rather than a wrong code — no reason to spend a round trip on it.
    if (otpCode.trim().length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code we emailed you`);
      return;
    }

    setLoading(true);

    try {
      await createAccount();
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      // Also on success: the stack swap that unmounts this screen is driven by
      // the auth listener, so until it lands the button is still on screen and
      // must not sit on "Verifying..." forever.
      setLoading(false);
    }
  };

  /**
   * Creates the account on the server, then signs in with the token it returns.
   *
   * Errors propagate: this used to catch them itself, which left the caller's
   * own catch unreachable and its `setLoading` never running.
   *
   * Verification and creation are one call: doing them separately here meant
   * nothing connected the emailed code to the account, and the code could be
   * skipped entirely by talking to Firebase directly with the bundled API key.
   * The profile document is written server-side too, so `role` and
   * `walletBalance` are seeded where a client cannot choose them.
   */
  const createAccount = async () => {
    const customToken = await registerWithOtp({
      email: formData.email,
      code: otpCode,
      password: formData.password,
      name: formData.name,
      phone: formData.phone,
      companyName: formData.companyName,
      gstNo: formData.gstNo,
      noOfOrders: formData.noOfOrders,
      companyType: formData.companyType,
    });

    // RootNavigator's auth listener takes over from here.
    await signInWithCustomToken(auth, customToken);
  };

  const orderOptions = ['0-50', '51-200', '200-500', '500+'];

  const companyOptions = [
    {
      value: 'B2C',
      label: 'B2C',
      description: 'Business to Consumer',
    },
    {
      value: 'B2B',
      label: 'B2B',
      description: 'Business to Business',
    },
    {
      value: 'D2C',
      label: 'D2C',
      description: 'Direct to Consumer',
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="justify-center bg-white p-6 mt-8">
          {/* Header */}
          <View className="items-center mb-8 mt-2">
            <View className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl items-center justify-center mb-3 shadow-xs">
              <Logo size={32} />
            </View>

            <Text className="text-2xl font-raleway-bold text-gray-900 text-center tracking-tight">
              Create Account
            </Text>

            <Text className="text-gray-500 mt-1 text-center font-raleway text-sm">
              {step === 1
                ? 'Create your account to manage shipments'
                : step === 2
                  ? 'Tell us a little about your business'
                  : `Enter the code we sent to ${formData.email.trim()}`}
            </Text>
          </View>

          {/* Step Indicator */}
          <View className="flex-row gap-2 mb-4">
            <View
              className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-violet-700' : 'bg-gray-200'
                }`}
            />

            <View
              className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-violet-700' : 'bg-gray-200'
                }`}
            />

            <View
              className={`flex-1 h-1 rounded-full ${step >= 3 ? 'bg-violet-700' : 'bg-gray-200'
                }`}
            />
          </View>

          <Text className="text-center text-xs font-raleway-bold text-gray-400 mb-5">
            STEP {step} OF 3
          </Text>

          {/* Error */}
          {error ? (
            <View className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl mb-4">
              <Text className="text-rose-600 text-sm font-raleway text-center">
                {error}
              </Text>
            </View>
          ) : null}

          {/* STEP 3 — email verification */}
          {step === 3 ? (
            <View>
              <Text className="text-gray-700 font-raleway-semibold text-sm mb-2">
                Verification code
              </Text>

              <TextInput
                value={otpCode}
                onChangeText={(text) => {
                  // The server accepts digits only; strip anything a keyboard
                  // or a paste from the email might add.
                  setOtpCode(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                placeholder="000000"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-raleway-bold text-2xl text-center tracking-[8px] text-gray-900 shadow-sm"
              />

              <Text className="text-gray-500 font-raleway text-xs text-center mt-3">
                The code expires in 10 minutes.
              </Text>

              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resendIn > 0}
                activeOpacity={0.7}
                className="mt-4 py-2"
              >
                <Text
                  className={`text-center font-raleway-semibold text-sm ${resendIn > 0 ? 'text-gray-400' : 'text-violet-700'
                    }`}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : step === 1 ? (
            <>
              {/* Google is offered only where an OAuth client is actually
                  configured; otherwise the button could only ever error out. */}
              {isGoogleSignInConfigured && (
                <>
                  <TouchableOpacity
                    onPress={handleGoogleSignIn}
                    disabled={googleLoading}
                    activeOpacity={0.8}
                    className="w-full bg-white border border-gray-200 py-3 rounded-xl flex-row items-center justify-center gap-2.5 shadow-xs mb-4"
                  >
                    {googleLoading ? (
                      <ActivityIndicator size="small" color="#7c3aed" />
                    ) : (
                      <>
                        <GoogleIcon size={18} />
                        <Text className="text-gray-800 font-raleway-bold text-xs">
                          Sign up with Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View className="flex-row items-center mb-4">
                    <View className="flex-1 h-[1px] bg-gray-200" />
                    <Text className="mx-3 text-[11px] font-raleway-bold text-gray-400 uppercase tracking-wider">
                      OR SIGN UP WITH EMAIL
                    </Text>
                    <View className="flex-1 h-[1px] bg-gray-200" />
                  </View>
                </>
              )}

              {/* Full Name */}
              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Full Name
                </Text>

                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather
                      name="user"
                      size={18}
                      color="#9ca3af"
                    />
                  </View>

                  <TextInput
                    value={formData.name}
                    onChangeText={(value) =>
                      updateField('name', value)
                    }
                    placeholder="John Doe"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Phone Number
                </Text>

                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather
                      name="phone"
                      size={18}
                      color="#9ca3af"
                    />
                  </View>

                  <TextInput
                    value={formData.phone}
                    onChangeText={(value) =>
                      updateField('phone', value.replace(/\D/g, ''))
                    }
                    placeholder="9876543210"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    maxLength={10}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>

              {/* Email */}
              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Email
                </Text>

                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather
                      name="mail"
                      size={18}
                      color="#9ca3af"
                    />
                  </View>

                  <TextInput
                    value={formData.email}
                    onChangeText={(value) =>
                      updateField('email', value)
                    }
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>

              {/* Password */}
              <View className="mb-2">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Password
                </Text>

                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather
                      name="lock"
                      size={18}
                      color="#9ca3af"
                    />
                  </View>

                  <TextInput
                    value={formData.password}
                    onChangeText={(value) =>
                      updateField('password', value)
                    }
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
                    autoComplete="new-password"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-12 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3.5 top-3.5"
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs font-raleway text-gray-400 mt-1 ml-1">
                  Minimum 6 characters
                </Text>
              </View>
            </>
          ) : (
            /* STEP 2 */
            <>
              <View className="mb-5">
                <Text className="text-xl font-raleway-bold text-gray-900">
                  Business Details
                </Text>

                <Text className="text-gray-500 font-raleway text-sm mt-1">
                  Help us understand your shipping needs
                </Text>
              </View>

              {/* Company Name */}
              <View className="mb-4">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  Company Name
                </Text>

                <View className="relative">
                  <View className="absolute left-3.5 top-3.5 z-10">
                    <Feather
                      name="briefcase"
                      size={18}
                      color="#9ca3af"
                    />
                  </View>

                  <TextInput
                    value={formData.companyName}
                    onChangeText={(value) =>
                      updateField('companyName', value)
                    }
                    placeholder="Acme Corp"
                    placeholderTextColor="#9ca3af"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                  />
                </View>
              </View>

              {/* GST */}
              <View className="mb-5">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-1">
                  GST Number
                  <Text className="font-raleway text-gray-400">
                    {' '}
                    (Optional)
                  </Text>
                </Text>

                <TextInput
                  value={formData.gstNo}
                  onChangeText={(value) =>
                    updateField('gstNo', value.toUpperCase())
                  }
                  placeholder="22AAAAA0000A1Z5"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-raleway text-sm text-gray-900 shadow-sm"
                />
              </View>

              {/* Monthly Orders */}
              <View className="mb-5">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-2">
                  Monthly Orders
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {orderOptions.map((option) => {
                    const selected =
                      formData.noOfOrders === option;

                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() =>
                          updateField('noOfOrders', option)
                        }
                        activeOpacity={0.8}
                        className={`px-4 py-3 rounded-xl border ${selected
                          ? 'bg-violet-700 border-purple-600'
                          : 'bg-white border-gray-200'
                          }`}
                      >
                        <Text
                          className={`font-raleway-semibold text-sm ${selected
                            ? 'text-white'
                            : 'text-gray-700'
                            }`}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Company Type */}
              <View className="mb-6">
                <Text className="text-xs font-raleway-bold text-gray-700 mb-2">
                  Company Type
                </Text>

                <View className="gap-2">
                  {companyOptions.map((option) => {
                    const selected =
                      formData.companyType === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() =>
                          updateField(
                            'companyType',
                            option.value
                          )
                        }
                        activeOpacity={0.8}
                        className={`p-3 rounded-xl border ${selected
                          ? 'bg-violet-700 border-purple-600'
                          : 'bg-white border-gray-200'
                          }`}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`w-9 h-9 rounded-lg items-center justify-center mr-3 ${selected
                              ? 'bg-purple-500'
                              : 'bg-gray-100'
                              }`}
                          >
                            <Feather
                              name="briefcase"
                              size={17}
                              color={
                                selected
                                  ? 'white'
                                  : '#6b7280'
                              }
                            />
                          </View>

                          <View className="flex-1">
                            <Text
                              className={`font-raleway-bold text-sm ${selected
                                ? 'text-white'
                                : 'text-gray-800'
                                }`}
                            >
                              {option.label}
                            </Text>

                            <Text
                              className={`text-xs font-raleway mt-0.5 ${selected
                                ? 'text-purple-100'
                                : 'text-gray-500'
                                }`}
                            >
                              {option.description}
                            </Text>
                          </View>

                          {selected && (
                            <Feather
                              name="check-circle"
                              size={20}
                              color="white"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="px-6 pt-4 pb-6 bg-white border-t border-gray-100">
        {step === 3 ? (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setError('');
                setStep(2);
              }}
              activeOpacity={0.8}
              className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center justify-center"
            >
              <Text className="text-gray-700 font-raleway-bold text-sm">
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleVerifyAndSignup}
              disabled={loading}
              activeOpacity={0.8}
              className={`flex-[2] bg-violet-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''
                }`}
              style={{ elevation: 3 }}
            >
              <Text className="text-white font-raleway-bold text-sm">
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </Text>

              {!loading && (
                <Feather
                  name="check"
                  size={17}
                  color="white"
                />
              )}
            </TouchableOpacity>
          </View>
        ) : step === 1 ? (
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            className="w-full bg-violet-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20"
            style={{ elevation: 3 }}
          >
            <Text className="text-white font-raleway-bold text-sm">
              Continue
            </Text>

            <Feather
              name="arrow-right"
              size={16}
              color="white"
            />
          </TouchableOpacity>
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setError('');
                setStep(1);
              }}
              activeOpacity={0.8}
              className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center justify-center"
            >
              <Text className="text-gray-700 font-raleway-bold text-sm">
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.8}
              className={`flex-[2] bg-violet-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20 ${loading ? 'opacity-70' : ''
                }`}
              style={{ elevation: 3 }}
            >
              <Text className="text-white font-raleway-bold text-sm">
                {loading
                  ? 'Sending code...'
                  : 'Continue'}
              </Text>

              {!loading && (
                <Feather
                  name="arrow-right"
                  size={17}
                  color="white"
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Login Link */}
        <View className="flex-row items-center justify-center mt-5">
          <Text className="text-xs font-raleway text-gray-500">
            Already have an account?{' '}
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
          >
            <Text className="font-raleway-bold text-xs text-purple-600">
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}