import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { api } from '../lib/api';
import { useUser } from '../lib/useUser';
import { toast } from '../lib/alert';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

type Channel = 'shopify' | 'woocommerce' | 'custom';

const TABS: { key: Channel; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'shopify', label: 'Shopify', icon: 'shopping-bag' },
  { key: 'woocommerce', label: 'WooCommerce', icon: 'globe' },
  { key: 'custom', label: 'API', icon: 'code' },
];

/** Strips protocol and trailing slash so the API always receives a bare host. */
const cleanDomain = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-gray-700 mb-1">{label}</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoCorrect={false}
        className="border-2 border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-900"
        {...props}
      />
      {!!hint && <Text className="text-[11px] text-gray-400 mt-1">{hint}</Text>}
    </View>
  );
}

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<Channel>('shopify');
  const [saving, setSaving] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [importing, setImporting] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  // Credentials default to what's saved on the profile; an edit becomes an
  // override so the saved values appear as soon as the profile loads.
  const [shopifyEdit, setShopifyEdit] = useState<{ domain: string; accessToken: string } | null>(
    null
  );
  const shopify = shopifyEdit ?? {
    domain: user?.integrations?.shopify?.domain || '',
    accessToken: user?.integrations?.shopify?.accessToken || '',
  };
  const setShopify = (update: (prev: typeof shopify) => typeof shopify) =>
    setShopifyEdit(update(shopify));

  const [wooEdit, setWooEdit] = useState<{ domain: string; key: string; secret: string } | null>(
    null
  );
  const woo = wooEdit ?? {
    domain: user?.integrations?.woocommerce?.domain || '',
    key: user?.integrations?.woocommerce?.key || '',
    secret: user?.integrations?.woocommerce?.secret || '',
  };
  const setWoo = (update: (prev: typeof woo) => typeof woo) => setWooEdit(update(woo));

  const shopifyReady = !!(shopify.domain && shopify.accessToken);
  const wooReady = !!(woo.domain && woo.key && woo.secret);

  const handleSaveShopify = async () => {
    if (!auth.currentUser) return;
    if (!shopifyReady) {
      toast.warning('Missing Details', 'Enter both the store domain and an access token.');
      return;
    }
    setSaving(true);
    try {
      const domain = cleanDomain(shopify.domain);
      // Registers the fulfilment webhooks on the store before persisting.
      await api.post('/api/integrations/shopify/setup', {
        userId: auth.currentUser.uid,
        domain,
        token: shopify.accessToken.trim(),
      });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'integrations.shopify.domain': domain,
        'integrations.shopify.accessToken': shopify.accessToken.trim(),
      });
      toast.success('Shopify Connected', 'Store saved and webhooks registered.');
    } catch (e: any) {
      toast.error('Connection Failed', e.message || 'Could not connect the Shopify store.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWoo = async () => {
    if (!auth.currentUser) return;
    if (!wooReady) {
      toast.warning('Missing Details', 'Enter the store URL, consumer key and secret.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'integrations.woocommerce.domain': cleanDomain(woo.domain),
        'integrations.woocommerce.key': woo.key.trim(),
        'integrations.woocommerce.secret': woo.secret.trim(),
      });
      toast.success('WooCommerce Connected', 'Store credentials saved.');
    } catch {
      toast.error('Error', 'Could not save the WooCommerce credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      if (activeTab === 'shopify') {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          'integrations.shopify.accessToken': null,
        });
        setShopify((p) => ({ ...p, accessToken: '' }));
      } else {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          'integrations.woocommerce.key': '',
          'integrations.woocommerce.secret': '',
        });
        setWoo((p) => ({ ...p, key: '', secret: '' }));
      }
      setOrders([]);
      toast.success('Disconnected', 'The store has been unlinked.');
    } catch {
      toast.error('Error', 'Could not disconnect the store.');
    } finally {
      setSaving(false);
    }
  };

  /** Fetches store orders, hiding any already imported into this account. */
  const fetchOrders = useCallback(async () => {
    if (!auth.currentUser) return;
    const source = activeTab;
    if (source === 'custom') return;
    if (source === 'shopify' ? !shopifyReady : !wooReady) {
      toast.warning('Not Connected', 'Save your store credentials first.');
      return;
    }

    setLoadingOrders(true);
    try {
      const existing = await getDocs(
        query(
          collection(db, `users/${auth.currentUser.uid}/shipments`),
          where('source', '==', source)
        )
      );
      const existingIds = new Set(existing.docs.map((d) => String(d.data().orderId)));

      const endpoint =
        source === 'shopify'
          ? `/api/integrations/shopify/orders?domain=${encodeURIComponent(
              cleanDomain(shopify.domain)
            )}&token=${encodeURIComponent(shopify.accessToken.trim())}`
          : `/api/integrations/woocommerce/orders?domain=${encodeURIComponent(
              cleanDomain(woo.domain)
            )}&key=${encodeURIComponent(woo.key)}&secret=${encodeURIComponent(woo.secret)}`;

      const data = await api.get(endpoint);
      const fetched: any[] = data.orders || [];

      const fresh = fetched
        .filter((o) =>
          !existingIds.has(
            String(source === 'shopify' ? o.name || o.order_number || o.id : o.id)
          )
        )
        .sort(
          (a, b) =>
            new Date(b.created_at || b.date_created || 0).getTime() -
            new Date(a.created_at || a.date_created || 0).getTime()
        );

      setOrders(fresh);
      toast.success(
        'Sync Complete',
        fresh.length > 0 ? `${fresh.length} new order(s) found.` : 'No new orders to import.'
      );
    } catch (e: any) {
      toast.error('Sync Failed', e.message || 'Could not fetch orders from the store.');
    } finally {
      setLoadingOrders(false);
    }
  }, [activeTab, shopify, woo, shopifyReady, wooReady]);

  /** Maps a store order onto the canonical shipment shape. */
  const mapOrder = (order: any, source: Channel) => {
    if (source === 'shopify') {
      const isCOD =
        order.gateway === 'cash_on_delivery' ||
        order.gateway === 'cod' ||
        (order.payment_gateway_names &&
          (order.payment_gateway_names.includes('cash_on_delivery') ||
            order.payment_gateway_names.includes('cod'))) ||
        order.financial_status === 'pending';

      // Shopify reports grams; fall back to 0.5 kg when the store omits it.
      const weight = order.total_weight ? order.total_weight / 1000 : 0.5;
      const side = Math.max(10, Math.round(Math.cbrt(weight * 5000)));
      const ship = order.shipping_address || {};
      const orderValue = parseFloat(order.total_price) || 0;

      return {
        orderId: String(order.name || order.order_number || order.id),
        shopifyOrderId: String(order.id),
        customerName:
          [ship.first_name, ship.last_name].filter(Boolean).join(' ') ||
          `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() ||
          'Shopify Customer',
        customerPhone: ship.phone || order.customer?.phone || order.phone || '',
        customerEmail: order.contact_email || order.email || order.customer?.email || '',
        address: [ship.address1, ship.address2].filter(Boolean).join(', '),
        city: ship.city || '',
        state: ship.province || '',
        pincode: ship.zip || '',
        country: ship.country || 'India',
        paymentMethod: isCOD ? 'COD' : 'Prepaid',
        orderValue,
        codAmount: isCOD ? orderValue : 0,
        productName: order.line_items?.map((i: any) => i.name).join(', ') || 'Shopify Order',
        productQty:
          order.line_items?.reduce((a: number, i: any) => a + (i.quantity || 1), 0) || 1,
        lineItems: order.line_items || [],
        weight,
        length: side,
        breadth: side,
        height: side,
        notes: order.note || '',
      };
    }

    const billing = order.billing || {};
    const shipping = order.shipping || {};
    const isCOD = order.payment_method === 'cod';
    const orderValue = parseFloat(order.total) || 0;

    return {
      orderId: String(order.id),
      customerName:
        `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'WooCommerce Customer',
      customerPhone: billing.phone || '',
      customerEmail: billing.email || '',
      address: [shipping.address_1, shipping.address_2].filter(Boolean).join(', '),
      city: shipping.city || '',
      state: shipping.state || '',
      pincode: shipping.postcode || '',
      paymentMethod: isCOD ? 'COD' : 'Prepaid',
      orderValue,
      codAmount: isCOD ? orderValue : 0,
      productName: order.line_items?.map((i: any) => i.name).join(', ') || 'WooCommerce Order',
      productQty: order.line_items?.reduce((a: number, i: any) => a + (i.quantity || 1), 0) || 1,
      lineItems: order.line_items || [],
      weight: 0.5,
      length: 10,
      breadth: 10,
      height: 10,
    };
  };

  const importAll = async () => {
    if (!auth.currentUser || orders.length === 0) return;
    const uid = auth.currentUser.uid;
    const source = activeTab;

    setImporting(true);
    try {
      const CHUNK = 400; // Firestore batch limit is 500 writes.
      for (let i = 0; i < orders.length; i += CHUNK) {
        const batch = writeBatch(db);
        orders.slice(i, i + CHUNK).forEach((order) => {
          const ref = doc(collection(db, `users/${uid}/shipments`));
          batch.set(ref, {
            userId: uid,
            source,
            status: 'Pending',
            createdAt: order.created_at
              ? new Date(order.created_at)
              : order.date_created
                ? new Date(order.date_created)
                : new Date(),
            updatedAt: serverTimestamp(),
            ...mapOrder(order, source),
          });
        });
        await batch.commit();
      }

      toast.success('Imported', `${orders.length} order(s) added as drafts.`);
      setOrders([]);
    } catch {
      toast.error('Import Failed', 'Could not import the orders.');
    } finally {
      setImporting(false);
    }
  };

  const connected = activeTab === 'shopify' ? shopifyReady : wooReady;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
      style={{ paddingTop: insets.top }}
    >
      <View className="px-5 py-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Sales Channels</Text>
      </View>

      {/* Tabs */}
      <View className="px-5 mb-4">
        <View className="flex-row bg-gray-100 rounded-xl p-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  // Fetched orders belong to the previous channel.
                  setOrders([]);
                }}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg ${
                  active ? 'bg-white' : ''
                }`}
                style={active ? { elevation: 1 } : undefined}
              >
                <Feather name={tab.icon} size={13} color={active ? '#111827' : '#6b7280'} />
                <Text
                  className={`text-xs font-bold ${active ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + BAR_HEIGHT + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'custom' ? (
          <View className="bg-white rounded-2xl p-5 border border-gray-100" style={{ elevation: 1 }}>
            <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center mb-3">
              <Feather name="code" size={22} color="#3b82f6" />
            </View>
            <Text className="font-bold text-gray-900 text-base mb-1">Custom API</Text>
            <Text className="text-sm text-gray-500 leading-5 mb-4">
              Push orders directly from your own system using the ShipMatrix REST API. Authenticate
              with the API key on your profile.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileTab', { screen: 'ApiDocs' })}
              activeOpacity={0.8}
              className="bg-violet-700 py-3 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-sm">View API Documentation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Connection status */}
            <View
              className={`rounded-2xl p-4 mb-4 border flex-row items-center gap-3 ${
                connected ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Feather
                name={connected ? 'check-circle' : 'alert-circle'}
                size={18}
                color={connected ? '#059669' : '#9ca3af'}
              />
              <Text
                className={`flex-1 text-sm font-bold ${
                  connected ? 'text-emerald-800' : 'text-gray-500'
                }`}
              >
                {connected ? 'Store connected' : 'Not connected yet'}
              </Text>
              {connected && (
                <TouchableOpacity onPress={handleDisconnect} disabled={saving} activeOpacity={0.7}>
                  <Text className="text-xs font-bold text-red-600">Disconnect</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Credentials */}
            <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4" style={{ elevation: 1 }}>
              {activeTab === 'shopify' ? (
                <>
                  <Text className="font-bold text-gray-900 mb-3">Shopify Credentials</Text>
                  <Field
                    label="Store Domain"
                    value={shopify.domain}
                    onChangeText={(v) => setShopify((p) => ({ ...p, domain: v }))}
                    placeholder="your-store.myshopify.com"
                    keyboardType="url"
                  />
                  <Field
                    label="Admin API Access Token"
                    value={shopify.accessToken}
                    onChangeText={(v) => setShopify((p) => ({ ...p, accessToken: v }))}
                    placeholder="shpat_..."
                    secureTextEntry
                    hint="Create a custom app in Shopify admin with read_orders and write_fulfillments scopes."
                  />
                  <TouchableOpacity
                    onPress={handleSaveShopify}
                    disabled={saving}
                    activeOpacity={0.8}
                    className={`bg-violet-700 py-3 rounded-xl items-center ${saving ? 'opacity-70' : ''}`}
                  >
                    <Text className="text-white font-bold text-sm">
                      {saving ? 'Connecting…' : 'Save & Register Webhooks'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text className="font-bold text-gray-900 mb-3">WooCommerce Credentials</Text>
                  <Field
                    label="Store URL"
                    value={woo.domain}
                    onChangeText={(v) => setWoo((p) => ({ ...p, domain: v }))}
                    placeholder="yourstore.com"
                    keyboardType="url"
                  />
                  <Field
                    label="Consumer Key"
                    value={woo.key}
                    onChangeText={(v) => setWoo((p) => ({ ...p, key: v }))}
                    placeholder="ck_..."
                  />
                  <Field
                    label="Consumer Secret"
                    value={woo.secret}
                    onChangeText={(v) => setWoo((p) => ({ ...p, secret: v }))}
                    placeholder="cs_..."
                    secureTextEntry
                    hint="WooCommerce → Settings → Advanced → REST API → Add key (Read/Write)."
                  />
                  <TouchableOpacity
                    onPress={handleSaveWoo}
                    disabled={saving}
                    activeOpacity={0.8}
                    className={`bg-violet-700 py-3 rounded-xl items-center ${saving ? 'opacity-70' : ''}`}
                  >
                    <Text className="text-white font-bold text-sm">
                      {saving ? 'Saving…' : 'Save Credentials'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Sync */}
            <View className="bg-white rounded-2xl p-5 border border-gray-100" style={{ elevation: 1 }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bold text-gray-900">Import Orders</Text>
                <TouchableOpacity
                  onPress={fetchOrders}
                  disabled={loadingOrders || !connected}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1.5"
                >
                  {loadingOrders ? (
                    <ActivityIndicator size="small" color="#7c3aed" />
                  ) : (
                    <Feather name="refresh-cw" size={14} color={connected ? '#7c3aed' : '#d1d5db'} />
                  )}
                  <Text
                    className={`text-xs font-bold ${connected ? 'text-violet-700' : 'text-gray-300'}`}
                  >
                    Sync
                  </Text>
                </TouchableOpacity>
              </View>

              {orders.length === 0 ? (
                <Text className="text-sm text-gray-400 py-3">
                  {connected
                    ? 'Tap Sync to pull new orders from your store.'
                    : 'Connect your store to import orders.'}
                </Text>
              ) : (
                <>
                  {orders.slice(0, 5).map((order, i) => {
                    const mapped = mapOrder(order, activeTab);
                    return (
                      <View
                        key={`${mapped.orderId}-${i}`}
                        className="border-b border-gray-100 py-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="font-bold text-gray-900 text-sm">#{mapped.orderId}</Text>
                          <Text className="font-black text-gray-900 text-sm">
                            ₹{mapped.orderValue.toFixed(0)}
                          </Text>
                        </View>
                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                          {mapped.customerName} · {mapped.city || 'Unknown city'}
                        </Text>
                      </View>
                    );
                  })}
                  {orders.length > 5 && (
                    <Text className="text-xs text-gray-400 text-center py-2">
                      +{orders.length - 5} more
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={importAll}
                    disabled={importing}
                    activeOpacity={0.8}
                    className={`bg-violet-700 py-3 rounded-xl items-center mt-4 ${
                      importing ? 'opacity-70' : ''
                    }`}
                  >
                    <Text className="text-white font-bold text-sm">
                      {importing ? 'Importing…' : `Import ${orders.length} order(s) as drafts`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
