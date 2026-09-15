import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
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
  const { confirm, confirmDialog } = useConfirm();

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
  const handleImport = () => {
    if (!auth.currentUser || orders.length === 0) return;

    confirm(
      {
        title: 'Confirm Import',
        message: `Are you sure you want to create ${orders.length} order${orders.length === 1 ? '' : 's'} from ${fileName || 'this file'}? They will be added to your Orders list as drafts.`,
        confirmText: `Yes, Import ${orders.length}`,
      },
      importOrders
    );
  };

  const importOrders = async () => {
    if (!auth.currentUser) return;
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
      <View className="flex-row items-center gap-3 px-5 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="font-raleway-bold text-xl text-gray-900">Bulk Upload</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}>
        {stage === 'pick' && (
          <>
            {/* Step 1 — template */}
            <View
              className="mb-4 rounded-2xl border border-gray-100 bg-white p-5"
              style={{ elevation: 1 }}>
              <Text className="mb-1 font-raleway-bold text-gray-900">
                Step 1 · Get the template
              </Text>
              <Text className="mb-4 font-raleway text-sm leading-5 text-gray-500">
                Your sheet needs these columns: Customer Name, Customer Phone, Address, Pincode and
                Weight. City, State, dimensions, Product Name, Order Value and Payment Method are
                optional.
              </Text>
              <TouchableOpacity
                onPress={handleCopyTemplate}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5">
                <Feather name="copy" size={15} color="#7c3aed" />
                <Text className="font-raleway-bold text-sm text-gray-700">Copy CSV template</Text>
              </TouchableOpacity>
            </View>

            {/* Step 2 — upload */}
            <View
              className="rounded-2xl border border-gray-100 bg-white p-5"
              style={{ elevation: 1 }}>
              <Text className="mb-1 font-raleway-bold text-gray-900">
                Step 2 · Upload your file
              </Text>
              <Text className="mb-4 font-raleway text-sm leading-5 text-gray-500">
                Orders are imported as drafts, then you pick a courier and book them from the Orders
                tab.
              </Text>

              <TouchableOpacity
                onPress={handlePick}
                disabled={parsing}
                activeOpacity={0.8}
                className="items-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
                {parsing ? (
                  <>
                    <ActivityIndicator color="#7c3aed" />
                    <Text className="mt-3 font-raleway-bold text-gray-700">Reading file…</Text>
                  </>
                ) : (
                  <>
                    <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50">
                      <Feather name="upload-cloud" size={26} color="#7c3aed" />
                    </View>
                    <Text className="font-raleway-bold text-gray-800">Select CSV file</Text>
                    <Text className="mt-1 font-raleway text-xs text-gray-500">
                      Up to 500 orders
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {stage === 'review' && (
          <>
            <View
              className="mb-4 rounded-2xl border border-gray-100 bg-white p-5"
              style={{ elevation: 1 }}>
              <View className="mb-3 flex-row items-center gap-2">
                <Feather name="file-text" size={18} color="#2563eb" />
                <Text className="flex-1 font-raleway-bold text-gray-900" numberOfLines={1}>
                  {fileName}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <Text className="font-black text-2xl text-emerald-700">{orders.length}</Text>
                  <Text className="font-bold text-[11px] uppercase tracking-wider text-emerald-600">
                    Ready
                  </Text>
                </View>
                <View className="flex-1 rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <Text className="font-black text-2xl text-amber-700">{errors.length}</Text>
                  <Text className="font-bold text-[11px] uppercase tracking-wider text-amber-600">
                    Skipped
                  </Text>
                </View>
              </View>
            </View>

            {errors.length > 0 && (
              <View className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <Text className="mb-2 font-raleway-bold text-sm text-amber-800">
                  These rows will be skipped
                </Text>
                {errors.slice(0, 8).map((err) => (
                  <Text key={err} className="font-raleway text-xs leading-5 text-amber-700">
                    • {err}
                  </Text>
                ))}
                {errors.length > 8 && (
                  <Text className="mt-1 font-raleway text-xs text-amber-600">
                    …and {errors.length - 8} more.
                  </Text>
                )}
              </View>
            )}

            {/* Preview */}
            <Text className="mb-2.5 font-raleway-bold text-xs uppercase tracking-wider text-gray-400">
              Preview
            </Text>
            {orders.slice(0, 5).map((order, i) => (
              <View
                key={`${order.orderId}-${i}`}
                className="mb-2 rounded-2xl border border-gray-100 bg-white p-4"
                style={{ elevation: 1 }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-raleway-bold text-sm text-gray-900">
                    {order.customerName}
                  </Text>
                  <View
                    className={`rounded-md px-2 py-0.5 ${
                      order.paymentMethod === 'COD' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                    <Text
                      className={`font-bold text-[10px] ${
                        order.paymentMethod === 'COD' ? 'text-orange-700' : 'text-blue-700'
                      }`}>
                      {order.paymentMethod.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 font-raleway text-xs text-gray-500" numberOfLines={1}>
                  {order.address}, {order.pincode}
                </Text>
                <Text className="mt-1 font-raleway text-[11px] text-gray-400">
                  {order.weight} kg · {order.productName}
                </Text>
              </View>
            ))}
            {orders.length > 5 && (
              <Text className="mb-3 mt-1 text-center font-raleway text-xs text-gray-400">
                +{orders.length - 5} more orders
              </Text>
            )}

            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.8}
              className={`mt-4 items-center rounded-full bg-violet-700 py-4 ${importing ? 'opacity-70' : ''}`}
              style={{ elevation: 4 }}>
              <Text className="font-raleway-bold text-sm text-white">
                {importing
                  ? 'Importing…'
                  : `Import ${orders.length} order${orders.length === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={reset}
              activeOpacity={0.7}
              className="mt-1 items-center py-3">
              <Text className="font-raleway-bold text-sm text-gray-500">
                Choose a different file
              </Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'done' && (
          <View
            className="mt-8 items-center rounded-2xl border border-gray-100 bg-white p-6"
            style={{ elevation: 1 }}>
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Feather name="check-circle" size={30} color="#16a34a" />
            </View>
            <Text className="mb-2 font-raleway-bold text-xl text-gray-900">Import complete</Text>
            <Text className="mb-6 text-center font-raleway text-sm leading-5 text-gray-500">
              {importedCount} order{importedCount === 1 ? '' : 's'} added as drafts. Open Orders to
              pick a courier and book them.
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('OrdersTab')}
              activeOpacity={0.8}
              className="mb-2 w-full items-center rounded-xl bg-violet-700 py-3.5">
              <Text className="font-raleway-bold text-white">Go to Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={reset}
              activeOpacity={0.8}
              className="w-full items-center rounded-xl border border-gray-300 bg-white py-3.5">
              <Text className="font-raleway-bold text-gray-700">Upload another file</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {confirmDialog}
    </View>
  );
}
