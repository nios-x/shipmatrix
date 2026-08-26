import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { toast } from '../lib/alert';

export default function BulkUploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
      if (!result.canceled && result.assets?.[0]) {
        toast.success('File Selected', `${result.assets[0].name} (CSV batch parser ready)`);
      }
    } catch {
      toast.error('File Error', 'Could not access the selected document.');
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="font-raleway-bold text-xl text-gray-900">Bulk Upload</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-white border-2 border-dashed border-gray-300 rounded-3xl p-8 items-center w-full" style={{ elevation: 1 }}>
          <View className="w-16 h-16 bg-purple-50 border border-purple-100 rounded-2xl items-center justify-center mb-4">
            <Feather name="upload-cloud" size={32} color="#7c3aed" />
          </View>
          <Text className="font-raleway-bold text-lg text-gray-900 mb-2">Upload CSV File</Text>
          <Text className="font-raleway text-sm text-gray-500 text-center mb-6 leading-5">
            Upload a CSV file with your order details to generate AWBs and book multiple shipments simultaneously.
          </Text>
          <TouchableOpacity onPress={handlePick} activeOpacity={0.8} className="bg-violet-700 px-8 py-3.5 rounded-xl shadow-lg shadow-purple-500/20" style={{ elevation: 4 }}>
            <Text className="font-raleway-bold text-white">Select CSV File</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
