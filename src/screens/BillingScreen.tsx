import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTransactions } from '../lib/useTransactions';
import { useUser } from '../lib/useUser';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toDate, formatDateTime } from '../lib/shipments';
import type { Transaction } from '../types';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Tab = 'invoices' | 'statements';

interface MonthlyInvoice {
  id: string;
  label: string;
  periodEnd: Date;
  spend: number;
  shipments: number;
}

/**
 * Invoices are derived from the wallet ledger: shipping consumption is the sum
 * of debits in a calendar month. The server generates the formal tax invoice on
 * the 1st, so only completed months are billable.
 */
function buildInvoices(transactions: Transaction[]): MonthlyInvoice[] {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
  const buckets = new Map<string, MonthlyInvoice>();

  transactions.forEach((tx) => {
    if (tx.type !== 'debit') return;
    const date = toDate(tx.createdAt);
    if (!date) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (key === currentKey) return; // Current month is not yet invoiced.

    if (!buckets.has(key)) {
      buckets.set(key, {
        id: `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        // Day 0 of the next month is the last day of this one.
        periodEnd: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        spend: 0,
        shipments: 0,
      });
    }

    const bucket = buckets.get(key)!;
    bucket.spend += Number(tx.amount) || 0;
    bucket.shipments += 1;
  });

  return [...buckets.values()].sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime());
}

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { transactions, loading } = useTransactions();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('invoices');

  const invoices = useMemo(() => buildInvoices(transactions), [transactions]);

  /** Groups the ledger by month so the statement reads chronologically. */
  const statementSections = useMemo(() => {
    const groups = new Map<string, { title: string; sortKey: number; data: Transaction[] }>();
    transactions.forEach((tx) => {
      const date = toDate(tx.createdAt);
      const title = date
        ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'Undated';
      const sortKey = date ? new Date(date.getFullYear(), date.getMonth()).getTime() : 0;
      if (!groups.has(title)) groups.set(title, { title, sortKey, data: [] });
      groups.get(title)!.data.push(tx);
    });
    return [...groups.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [transactions]);

  if (loading) return <LoadingSpinner fullScreen message="Loading billing..." />;

  const renderInvoices = () => (
    <View className="px-5">
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          subtitle="Invoices are generated on the 1st of each month for the previous month's shipping."
        />
      ) : (
        invoices.map((inv) => (
          <View
            key={inv.id}
            className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row items-center justify-between"
            style={{ elevation: 1 }}
          >
            <View className="flex-row items-start gap-3 flex-1">
              <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center">
                <Feather name="file-text" size={18} color="#7c3aed" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900">{inv.label}</Text>
                <Text className="text-[11px] font-medium text-gray-500 mt-0.5">
                  {inv.id} • {inv.shipments} shipment{inv.shipments === 1 ? '' : 's'}
                </Text>
                <Text className="text-sm font-black text-gray-900 mt-1.5">
                  ₹{inv.spend.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}

      <View className="mt-4 mb-8 bg-blue-50 border border-blue-100 p-4 rounded-2xl flex-row gap-3">
        <Feather name="info" size={18} color="#1d4ed8" />
        <Text className="flex-1 text-[13px] text-blue-800 leading-5">
          Invoices cover the previous month&apos;s shipping consumption and platform fees.
          {user?.gstNo
            ? ` Input Tax Credit is claimed against GSTIN ${user.gstNo}.`
            : ' Add your GSTIN in Profile to claim Input Tax Credit.'}
        </Text>
      </View>
    </View>
  );

  const renderStatements = () => (
    <SectionList
      sections={statementSections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <View
          className="bg-white rounded-2xl p-4 mb-2 border border-gray-100 flex-row items-center justify-between"
          style={{ elevation: 1 }}
        >
          <View className="flex-1 pr-3">
            <Text className="font-semibold text-sm text-gray-900" numberOfLines={1}>
              {item.description || (item.type === 'credit' ? 'Wallet recharge' : 'Shipping charge')}
            </Text>
            <Text className="text-[10px] text-gray-400 font-medium mt-0.5">
              {item.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text className="text-[11px] text-gray-400 mt-1">{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text
            className={`font-black text-sm ${
              item.type === 'credit' ? 'text-green-600' : 'text-gray-900'
            }`}
          >
            {item.type === 'credit' ? '+' : '−'}₹{(Number(item.amount) || 0).toFixed(2)}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <EmptyState title="No transactions" subtitle="Your wallet activity will appear here." />
      }
    />
  );

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Billing & Invoices</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 gap-6 border-b border-gray-200 bg-white">
        {(
          [
            { key: 'invoices', label: 'Monthly Invoices' },
            { key: 'statements', label: 'Account Statements' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              className={`pb-3 pt-3 border-b-2 ${active ? 'border-violet-600' : 'border-transparent'}`}
            >
              <Text
                className={`text-sm font-bold ${active ? 'text-violet-600' : 'text-gray-500'}`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-1 pt-2">
        {activeTab === 'invoices' ? renderInvoices() : renderStatements()}
      </View>
    </View>
  );
}
