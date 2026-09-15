import React, { useState } from 'react';
import { View, TouchableOpacity, FlatList } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { formatCount, formatCurrency } from '../lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUser } from '../lib/useUser';
import { useTransactions } from '../lib/useTransactions';
import { api, routes } from '../lib/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../lib/alert';
import { useConfirm } from '../components/useConfirm';
import { openCashfreeCheckout, CashfreeError } from '../lib/cashfree';
import { formatDate } from '../lib/shipments';
import type { Transaction } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

/** Backoff between verify polls while Cashfree reports the order as ACTIVE. */
const VERIFY_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { transactions, loading } = useTransactions();
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('500');
  const [processing, setProcessing] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  // Exact to the paisa: a balance is never rounded up the way a rate is.
  const balance = user?.walletBalance || 0;
  const balanceMain = formatCount(Math.trunc(balance));
  const balanceDec = Math.abs(balance).toFixed(2).split('.')[1];

  /**
   * Confirms a payment server-side. The server asks Cashfree directly and
   * credits the wallet, so the new balance arrives back through the `useUser`
   * snapshot rather than being set locally. The client never reports an amount.
   */
  const verifyPayment = async (orderId: string) => {
    // Cashfree is often still settling when the SDK hands control back, which
    // reads as ACTIVE rather than PAID. Believing that first answer tells
    // someone whose money has already left their account that nothing
    // happened, so the non-terminal state is retried before it is reported.
    for (let attempt = 0; ; attempt++) {
      const verifyRes = await api.post(routes.verifyPayment, {
        order_id: orderId,
      });

      if (verifyRes.success) {
        const credited =
          verifyRes.amount != null ? `${formatCurrency(verifyRes.amount)}` : 'Your payment';
        toast.success('Recharge Successful!', `${credited} has been added to your wallet.`);
        setShowRecharge(false);
        return;
      }

      const stillSettling = verifyRes.order_status === 'ACTIVE';
      if (!stillSettling || attempt >= VERIFY_RETRY_DELAYS_MS.length) {
        toast.error(
          stillSettling ? 'Payment Pending' : 'Payment Error',
          verifyRes.error || 'Payment verification failed.'
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, VERIFY_RETRY_DELAYS_MS[attempt]));
    }
  };

  const handleRecharge = () => {
    const amount = Number(rechargeAmount);
    if (!(amount >= 500)) {
      toast.warning('Minimum Amount', 'Minimum recharge amount is ₹500');
      return;
    }

    confirm(
      {
        title: 'Confirm Recharge',
        message: `Are you sure you want to add ${formatCurrency(amount)} to your wallet? You will be taken to the payment page to complete this transaction.`,
        confirmText: `Yes, Pay ${formatCurrency(amount)}`,
      },
      () => startRecharge(amount)
    );
  };

  const startRecharge = async (amount: number) => {
    setProcessing(true);
    try {
      // The server holds the Cashfree secret and returns `payment_session_id`
      // plus `order_id` from Cashfree's Create Order API. It re-validates the
      // amount, so this value is a request rather than an instruction.
      const order = await api.post(routes.createOrder, {
        amount,
        customer_name: user?.name,
        customer_email: user?.email,
        customer_phone: user?.phone,
      });

      const payment = await openCashfreeCheckout({
        paymentSessionId: order.payment_session_id,
        orderId: order.order_id,
        environment: order.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
      });

      await verifyPayment(payment.orderId);
    } catch (err: any) {
      if (err instanceof CashfreeError && err.cancelled) {
        toast.info('Payment Cancelled', 'No amount has been charged.');
      } else {
        toast.error('Recharge Error', err?.message || 'Recharge failed');
      }
    } finally {
      setProcessing(false);
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'credit';
    return (
      <View className="flex-row items-center justify-between border-b border-gray-100/70 py-3.5">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className={`h-10 w-10 items-center justify-center rounded-xl ${isCredit ? 'border border-emerald-100/80 bg-emerald-50' : 'border border-rose-100/80 bg-rose-50'}`}>
            <Feather
              name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
              size={18}
              color={isCredit ? '#059669' : '#e11d48'}
            />
          </View>
          <View className="flex-1">
            <Text className="font-raleway-semibold text-sm text-gray-900" numberOfLines={1}>
              {item.description || (isCredit ? 'Wallet Recharge' : 'Shipment Charge')}
            </Text>
            <Text className="mt-0.5 font-raleway text-xs text-gray-400">
              {formatDate(item.createdAt)}
            </Text>
          </View>
        </View>
        <Text
          className={`font-raleway-bold text-sm ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isCredit ? '+' : '-'}
          {formatCurrency(item.amount ?? 0)}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1">
          <Text className="font-black text-xl tracking-tight text-slate-900">Wallet</Text>
          <Text className="mt-0.5 font-medium text-xs text-slate-500">
            Manage balance & transaction history
          </Text>
        </View>

        {/* Right Action Button */}
        {!showRecharge && (
          <TouchableOpacity
            onPress={() => setShowRecharge(true)}
            activeOpacity={0.8}
            className="h-10 flex-row items-center gap-1.5 rounded-xl bg-violet-600 px-4 shadow-sm shadow-violet-500/20">
            <Feather name="plus" size={15} color="#FFFFFF" />
            <Text className="font-black text-xs text-white">Add Funds</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Balance Card */}
      <View
        className="mx-5 mb-5 rounded-3xl border border-slate-100 bg-white p-6"
        style={{
          shadowColor: '#7c3aed',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        }}>
        <Text className="mb-2 font-bold text-xs uppercase tracking-wider text-slate-400">
          Available Balance
        </Text>
        <View className="mb-4 flex-row items-baseline">
          <Text className="mr-1 font-bold text-sm text-slate-500">₹</Text>
          <Text className="font-black text-4xl tracking-tight text-slate-900">{balanceMain}</Text>
          <Text className="font-bold text-xl text-slate-400">.{balanceDec}</Text>
        </View>

        {!showRecharge ? (
          <TouchableOpacity
            onPress={() => setShowRecharge(true)}
            activeOpacity={0.8}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-full bg-violet-600 py-3.5 shadow-sm shadow-violet-500/20">
            <Feather name="zap" size={18} color="white" />
            <Text className="font-black text-sm text-white ">Recharge Wallet</Text>
          </TouchableOpacity>
        ) : (
          <View className="gap-3">
            <TextInput
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              placeholder="Amount (min ₹500)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-bold text-lg text-slate-900"
            />
            <View className="flex-row gap-2">
              {['500', '1000', '2000', '5000'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setRechargeAmount(amt)}
                  className={`flex-1 items-center rounded-xl border py-2 ${
                    rechargeAmount === amt
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-slate-200 bg-white'
                  }`}>
                  <Text
                    className={`font-bold text-xs ${
                      rechargeAmount === amt ? 'text-violet-700' : 'text-slate-600'
                    }`}>
                    {formatCurrency(Number(amt))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleRecharge}
                disabled={processing}
                activeOpacity={0.8}
                className={`flex-[2] items-center rounded-full bg-violet-600 py-3 shadow-sm shadow-violet-500/20 ${
                  processing ? 'opacity-70' : ''
                }`}>
                <Text className="font-black text-sm text-white">
                  {processing ? 'Processing...' : 'Pay Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Transactions */}
      <View className="mx-5 flex-1">
        <Text className="mb-3 font-bold text-xs uppercase tracking-wider text-slate-400">
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
            contentContainerStyle={{
              paddingBottom: insets.bottom + BAR_HEIGHT + 24,
            }}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Feather name="inbox" size={40} color="#CBD5E1" />
                <Text className="mt-3 font-medium text-sm text-slate-400">No transactions yet</Text>
              </View>
            }
          />
        )}
      </View>

      {confirmDialog}
    </View>
  );
}
