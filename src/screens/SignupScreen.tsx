import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/types';
import { Feather } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Logo } from '../components/Logo';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<Nav>();

  const [step, setStep] = useState(1);

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

    if (formData.password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    setStep(2);
  };

  const handleSignup = async () => {
    setError('');

    if (!formData.companyName.trim()) {
      setError('Please enter your company name');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: formData.name.trim(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        companyName: formData.companyName.trim(),
        gstNo: formData.gstNo.trim(),
        noOfOrders: formData.noOfOrders,
        companyType: formData.companyType,

        walletBalance: 0,
        role: 'user',

        createdAt: serverTimestamp(),
      });

      // RootNavigator/Auth listener should handle navigation.
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
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
        <View className="justify-center bg-white p-6 mt-12">
          {/* Header */}
          <View className="items-center mb-8 mt-4">
            <View className="bg-purple-100 p-4 rounded-full mb-4">
              <Logo size={32} />
            </View>

            <Text className="text-2xl font-bold text-gray-900 text-center">
              Create Account
            </Text>

            <Text className="text-gray-500 mt-2 text-center text-sm">
              {step === 1
                ? 'Create your account to manage shipments'
                : 'Tell us a little about your business'}
            </Text>
          </View>

          {/* Step Indicator */}
          <View className="flex-row gap-2 mb-6">
            <View
              className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-violet-700' : 'bg-gray-200'
                }`}
            />

            <View
              className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-violet-700' : 'bg-gray-200'
                }`}
            />
          </View>

          <Text className="text-center text-xs font-semibold text-gray-400 mb-5">
            STEP {step} OF 2
          </Text>

          {/* Error */}
          {error ? (
            <View className="bg-red-50 border border-red-100 p-3 rounded-xl mb-4">
              <Text className="text-red-600 text-sm font-medium text-center">
                {error}
              </Text>
            </View>
          ) : null}

          {/* STEP 1 */}
          {step === 1 ? (
            <>
              {/* Full Name */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Full Name
                </Text>

                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather
                      name="user"
                      size={20}
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
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Phone Number
                </Text>

                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather
                      name="phone"
                      size={20}
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
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>

              {/* Email */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Email
                </Text>

                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather
                      name="mail"
                      size={20}
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
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>

              {/* Password */}
              <View className="mb-2">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Password
                </Text>

                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather
                      name="lock"
                      size={20}
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
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-12 py-3 font-medium text-gray-900"
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-3.5"
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs text-gray-400 mt-1 ml-1">
                  Minimum 6 characters
                </Text>
              </View>
            </>
          ) : (
            /* STEP 2 */
            <>
              <View className="mb-5">
                <Text className="text-xl font-bold text-gray-900">
                  Business Details
                </Text>

                <Text className="text-gray-500 text-sm mt-1">
                  Help us understand your shipping needs
                </Text>
              </View>

              {/* Company Name */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  Company Name
                </Text>

                <View className="relative">
                  <View className="absolute left-3 top-3.5 z-10">
                    <Feather
                      name="briefcase"
                      size={20}
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
                    className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-4 py-3 font-medium text-gray-900"
                  />
                </View>
              </View>

              {/* GST */}
              <View className="mb-5">
                <Text className="text-sm font-semibold text-gray-700 mb-1">
                  GST Number
                  <Text className="font-normal text-gray-400">
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
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-medium text-gray-900"
                />
              </View>

              {/* Monthly Orders */}
              <View className="mb-5">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
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
                          : 'bg-white border-gray-300'
                          }`}
                      >
                        <Text
                          className={`font-semibold ${selected
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
                <Text className="text-sm font-semibold text-gray-700 mb-2">
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
                          : 'bg-white border-gray-300'
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
                              className={`font-bold ${selected
                                ? 'text-white'
                                : 'text-gray-800'
                                }`}
                            >
                              {option.label}
                            </Text>

                            <Text
                              className={`text-xs mt-0.5 ${selected
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
        {step === 1 ? (
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            className="w-full bg-violet-700 py-3 rounded-xl flex-row items-center justify-center gap-2"
          >
            <Text className="text-white font-bold text-base">
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
              className="flex-1 bg-gray-100 py-3 rounded-xl items-center justify-center"
            >
              <Text className="text-gray-700 font-bold">
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
              className={`flex-[2] bg-violet-700 py-3 rounded-xl flex-row items-center justify-center gap-2 ${loading ? 'opacity-70' : ''
                }`}
            >
              <Text className="text-white font-bold">
                {loading
                  ? 'Creating Account...'
                  : 'Create Account'}
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
        )}

        {/* Login Link */}
        <View className="flex-row items-center justify-center mt-6">
          <Text className="text-sm text-gray-600">
            Already have an account?{' '}
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
          >
            <Text className="font-bold text-purple-600">
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}