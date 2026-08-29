import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toast } from '../lib/alert';
import { parseOrdersCsv, CSV_TEMPLATE, type CsvOrder } from '../lib/csv';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Stage = 'pick' | 'review' | 'done';

export default function BulkUploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [orders, setOrders] = useState<CsvOrder[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Some Android providers report CSVs as octet-stream, so accept broadly
        // and let the parser reject anything that isn't delimited text.
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setParsing(true);
      setFileName(asset.name);

      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseOrdersCsv(content);

      if (parsed.missingHeaders.length > 0) {
        toast.error(
          'Invalid Template',
          `Missing required column${parsed.missingHeaders.length > 1 ? 's' : ''}: ${parsed.missingHeaders.join(', ')}.`
        );
        setStage('pick');
        return;
      }

      setOrders(parsed.orders);
      setErrors(parsed.errors);

      if (parsed.orders.length === 0) {
        toast.error('No Valid Rows', 'None of the rows in this file could be imported.');
        setStage('pick');
        return;
      }
      setStage('review');
    } catch {
      toast.error('File Error', 'Could not read the selected file.');
      setStage('pick');
    } finally {
      setParsing(false);
    }
  };

  /**
   * Writes the parsed rows as draft orders. They land with status 'New' so they
   * appear in Orders, where a courier can be picked and the shipment booked.
   */
  const handleImport = async () => {
    if (!auth.currentUser || orders.length === 0) return;
    const uid = auth.currentUser.uid;

    setImporting(true);
    try {
      // Firestore caps a batch at 500 writes.
      const CHUNK = 400;
      let written = 0;

      for (let i = 0; i < orders.length; i += CHUNK) {
        const batch = writeBatch(db);
        orders.slice(i, i + CHUNK).forEach((order, offset) => {
          const ref = doc(collection(db, `users/${uid}/shipments`));
          batch.set(ref, {
            userId: uid,
            source: 'bulk-upload',
            orderId: order.orderId || `ORD-${Date.now().toString().slice(-6)}-${i + offset + 1}`,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            address: order.address,
            city: order.city,
            state: order.state,
            pincode: order.pincode,
            weight: parseFloat(order.weight) || 0.5,
            length: parseFloat(order.length) || 10,
            breadth: parseFloat(order.breadth) || 10,
            height: parseFloat(order.height) || 10,
            productName: order.productName,
            orderValue: parseFloat(order.orderValue) || 0,
            paymentMethod: order.paymentMethod,
            codAmount: order.paymentMethod === 'COD' ? parseFloat(order.orderValue) || 0 : 0,
            status: 'New',
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
        written += Math.min(CHUNK, orders.length - i);
      }

      setImportedCount(written);
      setStage('done');
    } catch {
      toast.error('Import Failed', 'Could not save the orders. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleCopyTemplate = async () => {
    await Clipboard.setStringAsync(CSV_TEMPLATE);
    toast.success('Template Copied', 'Paste it into a spreadsheet and fill in your orders.');
  };

  const reset = () => {
    setStage('pick');
    setOrders([]);
    setErrors([]);
    setFileName('');
    setImportedCount(0);
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="font-raleway-bold text-xl text-gray-900">Bulk Upload</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {stage === 'pick' && (
          <>
            {/* Step 1 — template */}
            <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4" style={{ elevation: 1 }}>
              <Text className="font-raleway-bold text-gray-900 mb-1">Step 1 · Get the template</Text>
              <Text className="font-raleway text-sm text-gray-500 mb-4 leading-5">
                Your sheet needs these columns: Customer Name, Customer Phone, Address, Pincode and
                Weight. City, State, dimensions, Product Name, Order Value and Payment Method are
                optional.
              </Text>
              <TouchableOpacity
                onPress={handleCopyTemplate}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 border border-gray-200 bg-gray-50 py-2.5 rounded-xl"
              >
                <Feather name="copy" size={15} color="#7c3aed" />
                <Text className="font-raleway-bold text-sm text-gray-700">Copy CSV template</Text>
              </TouchableOpacity>
            </View>

            {/* Step 2 — upload */}
            <View className="bg-white rounded-2xl p-5 border border-gray-100" style={{ elevation: 1 }}>
              <Text className="font-raleway-bold text-gray-900 mb-1">Step 2 · Upload your file</Text>
              <Text className="font-raleway text-sm text-gray-500 mb-4 leading-5">
                Orders are imported as drafts, then you pick a courier and book them from the Orders
                tab.
              </Text>

              <TouchableOpacity
                onPress={handlePick}
                disabled={parsing}
                activeOpacity={0.8}
                className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-2xl p-8 items-center"
              >
                {parsing ? (
                  <>
                    <ActivityIndicator color="#7c3aed" />
                    <Text className="font-raleway-bold text-gray-700 mt-3">Reading file…</Text>
                  </>
                ) : (
                  <>
                    <View className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl items-center justify-center mb-3">
                      <Feather name="upload-cloud" size={26} color="#7c3aed" />
                    </View>
                    <Text className="font-raleway-bold text-gray-800">Select CSV file</Text>
                    <Text className="font-raleway text-xs text-gray-500 mt-1">Up to 500 orders</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {stage === 'review' && (
          <>
            <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4" style={{ elevation: 1 }}>
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="file-text" size={18} color="#2563eb" />
                <Text className="font-raleway-bold text-gray-900 flex-1" numberOfLines={1}>
                  {fileName}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <Text className="text-2xl font-black text-emerald-700">{orders.length}</Text>
                  <Text className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    Ready
                  </Text>
                </View>
                <View className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <Text className="text-2xl font-black text-amber-700">{errors.length}</Text>
                  <Text className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                    Skipped
                  </Text>
                </View>
              </View>
            </View>

            {errors.length > 0 && (
              <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                <Text className="font-raleway-bold text-amber-800 text-sm mb-2">
                  These rows will be skipped
                </Text>
                {errors.slice(0, 8).map((err) => (
                  <Text key={err} className="font-raleway text-xs text-amber-700 leading-5">
                    • {err}
                  </Text>
                ))}
                {errors.length > 8 && (
                  <Text className="font-raleway text-xs text-amber-600 mt-1">
                    …and {errors.length - 8} more.
                  </Text>
                )}
              </View>
            )}

            {/* Preview */}
            <Text className="text-xs font-raleway-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Preview
            </Text>
            {orders.slice(0, 5).map((order, i) => (
              <View
                key={`${order.orderId}-${i}`}
                className="bg-white rounded-2xl p-4 mb-2 border border-gray-100"
                style={{ elevation: 1 }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-raleway-bold text-gray-900 text-sm">{order.customerName}</Text>
                  <View
                    className={`px-2 py-0.5 rounded-md ${
                      order.paymentMethod === 'COD' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        order.paymentMethod === 'COD' ? 'text-orange-700' : 'text-blue-700'
                      }`}
                    >
                      {order.paymentMethod.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text className="font-raleway text-xs text-gray-500 mt-1" numberOfLines={1}>
                  {order.address}, {order.pincode}
                </Text>
                <Text className="font-raleway text-[11px] text-gray-400 mt-1">
                  {order.weight} kg · {order.productName}
                </Text>
              </View>
            ))}
            {orders.length > 5 && (
              <Text className="font-raleway text-xs text-gray-400 text-center mt-1 mb-3">
                +{orders.length - 5} more orders
              </Text>
            )}

            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.8}
              className={`bg-violet-700 py-4 rounded-full items-center mt-4 ${importing ? 'opacity-70' : ''}`}
              style={{ elevation: 4 }}
            >
              <Text className="font-raleway-bold text-white text-sm">
                {importing ? 'Importing…' : `Import ${orders.length} order${orders.length === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} activeOpacity={0.7} className="py-3 items-center mt-1">
              <Text className="font-raleway-bold text-gray-500 text-sm">Choose a different file</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'done' && (
          <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center mt-8" style={{ elevation: 1 }}>
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Feather name="check-circle" size={30} color="#16a34a" />
            </View>
            <Text className="font-raleway-bold text-xl text-gray-900 mb-2">Import complete</Text>
            <Text className="font-raleway text-sm text-gray-500 text-center mb-6 leading-5">
              {importedCount} order{importedCount === 1 ? '' : 's'} added as drafts. Open Orders to
              pick a courier and book them.
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('OrdersTab')}
              activeOpacity={0.8}
              className="bg-violet-700 w-full py-3.5 rounded-xl items-center mb-2"
            >
              <Text className="font-raleway-bold text-white">Go to Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={reset}
              activeOpacity={0.8}
              className="bg-white border border-gray-300 w-full py-3.5 rounded-xl items-center"
            >
              <Text className="font-raleway-bold text-gray-700">Upload another file</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
