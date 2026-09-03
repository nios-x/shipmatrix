import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { api, routes } from '../lib/api';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Monotonic counter rather than Date.now(): two messages appended in the same
// millisecond would otherwise collide as React keys.
let messageCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++messageCounter}`;

/**
 * The assistant answers in Markdown, so `**bold**` reached the bubble as literal
 * asterisks. Only emphasis is handled — it is the one construct the model uses
 * mid-sentence, where the stray punctuation is most distracting. Headings and
 * list bullets stay as they are, since they already read correctly as plain text.
 */
function renderMarkdown(content: string, onDark: boolean) {
  // Split on the delimiters themselves so the captured groups land on odd
  // indices, which is what marks a run as bold.
  return content.split(/\*\*(.+?)\*\*/gs).map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} className={onDark ? 'font-bold text-white' : 'font-bold text-gray-900'}>
        {part}
      </Text>
    ) : (
      part
    )
  );
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
    const text = input.trim();
    if (!text || sending) return;

    // Snapshot the transcript before appending, so the history sent to the
    // server excludes the message being asked about.
    const priorMessages = messages;
    setMessages((prev) => [...prev, { id: nextId('u'), role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const data = await api.post(routes.supportChat, {
        message: text,
        // The Gemini-backed endpoint expects 'user'/'model' roles.
        history: priorMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content,
        })),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('a'),
          role: 'assistant',
          content: data.reply || 'Sorry, I could not process that.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('a'),
          role: 'assistant',
          content:
            'Something went wrong. Please try again, or email support@shipmatrix.in for help.',
        },
      ]);
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
            <View className={`px-4 py-3 rounded-2xl ${item.role === 'user' ? 'bg-violet-700 rounded-br-md' : 'bg-white border border-gray-100 rounded-bl-md'}`}>
              <Text className={`text-sm ${item.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                {renderMarkdown(item.content, item.role === 'user')}
              </Text>
            </View>
          </View>
        )}
        // The reply can take a while; without a pending bubble the screen looks
        // frozen and people send the message again.
        ListFooterComponent={
          sending ? (
            <View className="self-start max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-gray-100 flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text className="text-sm text-gray-500">Thinking…</Text>
            </View>
          ) : null
        }
      />

      {/* The tab bar floats above the screen rather than pushing it up, so the
          composer has to reserve its height itself; padding for the safe-area
          inset alone leaves it sitting underneath, unreachable. */}
      <View
        className="px-5 py-3 border-t border-gray-100 bg-white flex-row items-center gap-3"
        style={{ paddingBottom: insets.bottom + BAR_HEIGHT + 12 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity onPress={handleSend} disabled={sending} className="bg-violet-700 w-10 h-10 rounded-xl items-center justify-center">
          <Feather name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
