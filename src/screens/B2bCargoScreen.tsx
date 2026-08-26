import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';
import { toast } from '../lib/alert';

export default function B2bCargoScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ pickupPincode: '', deliveryPincode: '', weight: '', invoiceValue: '', noOfBoxes: '1' });
  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.pickupPincode || !form.deliveryPincode || !form.weight) {
      toast.warning('Incomplete Form', 'Please enter pickup pincode, delivery pincode, and weight.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/v1/xpressbees/b2b-cargo', form);
      if (res.success) {
        toast.success('Request Submitted!', 'B2B cargo quote request sent successfully.');
      } else {
        toast.error('Submission Error', res.error || 'Failed to submit request');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-left" size={24} color="#1f2937" /></TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">B2B Cargo</Text>
      </View>
      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-3xl p-5 border border-gray-100 gap-3.5 mb-6" style={{ elevation: 1 }}>
          {[{ l: 'Pickup Pincode', k: 'pickupPincode', p: '400001' }, { l: 'Delivery Pincode', k: 'deliveryPincode', p: '110001' }, { l: 'Weight (kg)', k: 'weight', p: '50' }, { l: 'Invoice Value (₹)', k: 'invoiceValue', p: '10000' }, { l: 'No. of Boxes', k: 'noOfBoxes', p: '1' }].map((f) => (
            <View key={f.k}>
              <Text className="font-geist-semibold text-xs text-gray-600 mb-1">{f.l}</Text>
              <TextInput value={(form as any)[f.k]} onChangeText={(v) => update(f.k, v)} placeholder={f.p} placeholderTextColor="#9ca3af" keyboardType="number-pad" className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-geist text-sm text-gray-900" />
            </View>
          ))}
          <TouchableOpacity onPress={handleSubmit} disabled={loading} className={`bg-violet-700 py-4 rounded-xl items-center mt-2 ${loading ? 'opacity-70' : ''}`} style={{ elevation: 4 }}>
            <Text className="font-geist-bold text-white">{loading ? 'Submitting...' : 'Get B2B Quote'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
