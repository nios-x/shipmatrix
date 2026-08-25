import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { useTransactions } from '../lib/useTransactions';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import type { Transaction } from '../types';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { transactions, loading } = useTransactions();
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('500');
  const [processing, setProcessing] = useState(false);

  const balanceStr = (user?.walletBalance || 0).toFixed(2);
  const [balanceMain, balanceDec] = balanceStr.split('.');

  const handleRecharge = async () => {
    const amount = Number(rechargeAmount);
    if (amount < 500) {
      toast.warning('Minimum Amount', 'Minimum recharge amount is ₹500');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.post('/api/razorpay/create-order', {
        amount,
        customer_id: user?.id,
        customer_name: user?.name,
        customer_email: user?.email,
        customer_phone: user?.phone,
      });

      if (res.sandbox) {
        // Simulate payment in sandbox mode
        const verifyRes = await api.post('/api/razorpay/verify', {
          razorpay_order_id: res.order_id,
          razorpay_payment_id: `pay_sim_${Date.now()}`,
          razorpay_signature: 'simulated_signature',
          sim_amount: amount,
          sim_user: auth.currentUser?.uid,
        });

        if (verifyRes.success) {
          toast.success('Recharge Successful!', `₹${amount} has been added to your wallet.`);
          setShowRecharge(false);
        } else {
          toast.error('Payment Error', 'Payment verification failed');
        }
      } else {
        toast.info('Razorpay Mode', 'Production payments connect to Razorpay Checkout.');
      }
    } catch (err: any) {
      toast.error('Recharge Error', err.message || 'Recharge failed');
    } finally {
      setProcessing(false);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    return (
      <View className="flex-row items-center justify-between py-3.5 border-b border-gray-100/70">
        <View className="flex-row items-center gap-3 flex-1">
          <View className={`w-10 h-10 rounded-xl items-center justify-center ${isCredit ? 'bg-emerald-50 border border-emerald-100/80' : 'bg-rose-50 border border-rose-100/80'}`}>
            <Feather name={isCredit ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={isCredit ? '#059669' : '#e11d48'} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-geist-semibold text-gray-900" numberOfLines={1}>
              {item.description || (isCredit ? 'Wallet Recharge' : 'Shipment Charge')}
            </Text>
            <Text className="text-xs font-geist text-gray-400 mt-0.5">
              {item.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}
            </Text>
          </View>
        </View>
        <Text className={`text-sm font-geist-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isCredit ? '+' : '-'}₹{item.amount?.toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4">
        <Text className="text-2xl font-geist-bold text-gray-900 tracking-tight">Wallet</Text>
      </View>

      {/* Balance Card */}
      <View
        className="mx-5 mb-5 rounded-3xl p-6 border border-gray-100/80 bg-white"
        style={{
          shadowColor: '#7c3aed',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 3,
        }}
      >
        <Text className="text-xs font-geist-bold text-gray-400 uppercase tracking-wider mb-2">
          Available Balance
        </Text>
        <View className="flex-row items-baseline mb-4">
          <Text className="text-sm font-geist-bold text-gray-500 mr-1">₹</Text>
          <Text className="text-4xl font-geist-black text-gray-900 tracking-tight">
            {balanceMain}
          </Text>
          <Text className="text-xl font-geist-bold text-gray-400">.{balanceDec}</Text>
        </View>

        {!showRecharge ? (
          <TouchableOpacity
            onPress={() => setShowRecharge(true)}
            activeOpacity={0.8}
            className="bg-purple-900 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-purple-900/20"
            style={{ elevation: 3 }}
          >
            <Feather name="zap" size={18} color="white" />
            <Text className="text-white font-geist-bold text-sm">Recharge Wallet</Text>
          </TouchableOpacity>
        ) : (
          <View className="gap-3">
            <TextInput
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              placeholder="Amount (min ₹500)"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-geist-bold text-gray-900 text-center"
            />
            <View className="flex-row gap-2">
              {['500', '1000', '2000', '5000'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setRechargeAmount(amt)}
                  className={`flex-1 py-2 rounded-xl border items-center ${rechargeAmount === amt ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-xs font-geist-bold ${rechargeAmount === amt ? 'text-purple-700' : 'text-gray-600'}`}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowRecharge(false)} className="flex-1 bg-gray-100 py-3 rounded-xl items-center">
                <Text className="font-geist-bold text-gray-600 text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRecharge}
                disabled={processing}
                activeOpacity={0.8}
                className={`flex-[2] bg-purple-900 py-3 rounded-xl items-center shadow-md shadow-purple-900/20 ${processing ? 'opacity-70' : ''}`}
              >
                <Text className="text-white font-geist-bold text-sm">{processing ? 'Processing...' : 'Pay Now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Transactions */}
      <View className="flex-1 mx-5">
        <Text className="text-xs font-geist-bold text-gray-400 uppercase tracking-wider mb-3">
          Transaction History
        </Text>

        {loading ? (
          <LoadingSpinner message="Loading transactions..." />
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Feather name="inbox" size={40} color="#d1d5db" />
                <Text className="text-gray-400 font-geist-medium text-sm mt-3">No transactions yet</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
