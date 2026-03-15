import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { chatApi } from '../../src/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{ name: string; status: 'running' | 'done' }>;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hey${user?.user_metadata?.full_name ? ` ${user.user_metadata.full_name.split(' ')[0]}` : ''}! I'm Ava — your companion on the go. I can manage your tasks, write journal entries, and chat about anything. What's on your mind?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const avaMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, avaMsg]);

    // Build history (exclude system greeting and current message)
    const history = messages
      .filter(m => m.id !== '1') // skip greeting
      .map(m => ({ role: m.role, content: m.content }));

    try {
      await chatApi.sendMessage(
        input.trim(),
        history,
        { provider: '', model: 'glm-4-flash', apiKey: '' },
        (text) => {
          setMessages(prev => prev.map(m =>
            m.id === avaMsg.id ? { ...m, content: m.content + text } : m
          ));
        },
      );
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === avaMsg.id
          ? { ...m, content: `Sorry, I couldn't connect right now. ${err.message || 'Please try again.'}` }
          : m
      ));
    } finally {
      setStreaming(false);
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.avaBubble]}>
      {item.role === 'assistant' && (
        <View style={styles.avaHeader}>
          <Text style={styles.avaName}>Ava</Text>
          <View style={styles.avaBadge}>
            <Text style={styles.avaBadgeText}>SUPERNOVA</Text>
          </View>
        </View>
      )}
      <Text style={[styles.messageText, item.role === 'user' && styles.userText]}>
        {item.content}
        {streaming && item.role === 'assistant' && item.id === messages[messages.length - 1]?.id && (
          <Text style={styles.cursor}>▊</Text>
        )}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ava</Text>
          <Text style={styles.headerSub}>Companion</Text>
        </View>
        <View style={styles.statusDot} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message Ava..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
            editable={!streaming}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || streaming) && styles.sendDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || streaming}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: fonts.sizes.xs,
    color: colors.purple,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.purple,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  avaBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  avaName: {
    fontSize: fonts.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  avaBadge: {
    backgroundColor: colors.purpleDark,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  avaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.purpleLight,
    letterSpacing: 1,
  },
  messageText: {
    fontSize: fonts.sizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  cursor: {
    color: colors.purple,
    fontSize: fonts.sizes.md,
  },
  timestamp: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fonts.sizes.md,
    color: colors.text,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.purple,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
});
