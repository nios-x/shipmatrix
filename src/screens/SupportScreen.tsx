import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Hi! How can I help you today? Ask me anything about ShipMatrix.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const data = await api.post('/api/support/chat', { message: userMsg.content });
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply || 'Sorry, I could not process that.' }]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-4 flex-row items-center gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900">Support</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) => (
          <View className={`max-w-[85%] ${item.role === 'user' ? 'self-end' : 'self-start'}`}>
            <View className={`px-4 py-3 rounded-2xl ${item.role === 'user' ? 'bg-purple-900 rounded-br-md' : 'bg-white border border-gray-100 rounded-bl-md'}`}>
              <Text className={`text-sm ${item.role === 'user' ? 'text-white' : 'text-gray-800'}`}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      <View className="px-5 py-3 border-t border-gray-100 bg-white flex-row items-center gap-3" style={{ paddingBottom: insets.bottom + 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity onPress={handleSend} disabled={sending} className="bg-purple-900 w-10 h-10 rounded-xl items-center justify-center">
          <Feather name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
