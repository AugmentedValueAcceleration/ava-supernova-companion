'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sendChat, apiFetch, MODELS } from '@/lib/api';
import { getActiveProviderKey } from '@/components/SettingsView';
import { loadPersonality, buildPersonalityPrefix } from '@/lib/personality';
import {
  getConversations, getActiveConversationId, setActiveConversationId,
  getConversation, saveConversation, deleteConversation as deleteConv,
  generateTitle, createConversation,
  type Conversation,
} from '@/lib/chat-history';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const NUDGE_AFTER_MESSAGES = 6;

function getFriendlyError(message?: string): string {
  const msg = (message || '').toLowerCase();

  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('err_internet'))
    return "Looks like you're offline. Check your connection and try again.";

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many'))
    return "You're sending messages a bit fast — give it a moment and try again.";

  if (msg.includes('401') || msg.includes('not authenticated') || msg.includes('invalid api key'))
    return "Your session expired. Try signing in again from Settings.";

  if (msg.includes('403') || msg.includes('not available on your plan') || msg.includes('no api key'))
    return "No API key or account detected. Sign up for 3M free Qwen tokens, or add your own API key in Settings.";

  if (msg.includes('token limit') || msg.includes('limit reached'))
    return "You've used your token allowance. Top up at ava-supernova.com/pricing, or add your own API key in Settings.";

  if (msg.includes('502') || msg.includes('503') || msg.includes('provider'))
    return "The AI provider is having a rough moment. Try switching models or wait a minute.";

  if (msg.includes('timeout') || msg.includes('timed out'))
    return "That took too long — the AI provider might be under heavy load. Try again in a moment.";

  if (msg.includes('500') || msg.includes('internal'))
    return "Something went wrong on our end. Try again — if it keeps happening, let us know.";

  return "Something went wrong. Try again, or switch to a different model if this keeps happening.";
}

const OFFLINE_QUEUE_KEY = 'ava-offline-queue';

function getOfflineQueue(): Array<{ message: string; model: string; timestamp: string }> {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: Array<{ message: string; model: string; timestamp: string }>) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function useChat({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  session,
  token,
  isGuest,
  userName,
}: {
  session: Session | null;
  token: string | null;
  isGuest: boolean;
  userName: string;
}) {
  const greeting: Message = {
    id: '1', role: 'assistant', timestamp: new Date(),
    content: isGuest
      ? "Hey! I'm Ava. To start chatting, either sign in for the free tier (3M Qwen tokens a month) or drop your own API key into Settings — Kimi, DeepSeek, Claude, GLM, Mistral all work.\n\nTell me what you're up to."
      : `Hey ${userName}! I'm Ava — your companion on the go. I can manage your tasks, write journal entries, and chat about anything.\n\nWhat's on your mind?`,
  };

  const [conversationId, setConversationId] = useState<string | null>(() => getActiveConversationId());
  const [messages, setMessages] = useState<Message[]>(() => {
    const id = getActiveConversationId();
    if (id) {
      const conv = getConversation(id);
      if (conv && conv.messages.length > 0) {
        return [greeting, ...conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))];
      }
    }
    return [greeting];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === 'undefined') return 'qwen3.5-flash';
    const stored = localStorage.getItem('ava-companion-model');
    if (stored) return stored;
    if (isGuest) {
      // Guest with no saved preference — pick the first model they hold a
      // BYOK key for. If none, return empty so send-time shows the friendly
      // "sign in or add a key" message rather than attempting a guest Qwen
      // call that the server will reject.
      for (const m of MODELS) {
        if (getActiveProviderKey(m.id)) return m.id;
      }
      return '';
    }
    return 'qwen3.5-flash';
  });
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [usageWarning, setUsageWarning] = useState<{ level: string; message: string }>({ level: 'none', message: '' });
  const [tokenBalance, setTokenBalance] = useState<{ used: number; limit: number; tier: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Fetch token balance on mount and expose for header display
  const fetchTokenBalance = useCallback(() => {
    if (!token) return;
    apiFetch('/account-info', {}, token).then(r => r.json()).then(data => {
      if (data?.usage) {
        const tier = data.tier || 'free';
        const hasSub = data.usage.tokens_limit > 0 && tier !== 'free';
        const used = hasSub ? data.usage.tokens_used || 0 : data.usage.free_tokens_used;
        const limit = hasSub ? data.usage.tokens_limit : data.usage.free_tokens_limit;
        setTokenBalance({ used, limit, tier });
      }
      if (data?.warning && data.warning !== 'none') {
        setUsageWarning({ level: data.warning, message: data.warning_message || '' });
      }
    }).catch(() => {});
  }, [token]);

  useEffect(() => { fetchTokenBalance(); }, [fetchTokenBalance]);

  // Save messages to conversation on change (skip greeting-only)
  useEffect(() => {
    const real = messages.filter(m => m.id !== '1');
    if (real.length === 0) return;

    const id = conversationId || createConversation(selectedModel).id;
    if (!conversationId) setConversationId(id);

    const conv: Conversation = {
      id,
      title: generateTitle(real),
      messages: real.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
      model: selectedModel,
      createdAt: getConversation(id)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveConversation(conv);
  }, [messages, conversationId, selectedModel]);

  // Offline queue flush
  useEffect(() => {
    const flushQueue = async () => {
      const queue = getOfflineQueue();
      if (queue.length === 0) return;

      // Clear queue first to avoid double-send
      localStorage.removeItem(OFFLINE_QUEUE_KEY);

      for (const item of queue) {
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: item.message,
          timestamp: new Date(item.timestamp),
        };
        const avaMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg, avaMsg]);
        setStreaming(true);

        const history = messages
          .filter(m => m.id !== '1')
          .map(m => ({ role: m.role, content: m.content }));

        try {
          const byokKey = getActiveProviderKey(item.model);
          await sendChat(token, item.message, history, item.model, (text) => {
            setMessages(prev => prev.map(m =>
              m.id === avaMsg.id ? { ...m, content: m.content + text } : m
            ));
          }, byokKey);
        } catch (err: any) {
          const friendlyError = getFriendlyError(err.message);
          setMessages(prev => prev.map(m =>
            m.id === avaMsg.id ? { ...m, content: friendlyError } : m
          ));
        } finally {
          setStreaming(false);
        }
      }
    };

    const handleOnline = () => {
      setOfflineBanner(false);
      flushQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [token, messages]);

  const showNudge = isGuest && messageCount >= NUDGE_AFTER_MESSAGES && !nudgeDismissed;

  const startNewChat = useCallback(() => {
    setConversationId(null);
    setActiveConversationId(null);
    setMessages([greeting]);
    setShowHistory(false);
    inputRef.current?.focus();
  }, [greeting]);

  const loadConversation = useCallback((id: string) => {
    const conv = getConversation(id);
    if (conv) {
      setConversationId(id);
      setActiveConversationId(id);
      setMessages([greeting, ...conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))]);
      setSelectedModel(conv.model);
      localStorage.setItem('ava-companion-model', conv.model);
    }
    setShowHistory(false);
  }, [greeting]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConv(id);
    setConversations(getConversations());
    if (conversationId === id) startNewChat();
  }, [conversationId, startNewChat]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;

    // Offline queue
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = getOfflineQueue();
      queue.push({ message: input.trim(), model: selectedModel, timestamp: new Date().toISOString() });
      saveOfflineQueue(queue);

      // Show the message in the UI with a queued note
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };
      const queuedMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "You're offline. Your message has been queued and will be sent when you're back online.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg, queuedMsg]);
      setInput('');
      setOfflineBanner(true);
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const avaMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, avaMsg]);
    setInput('');
    setStreaming(true);
    setMessageCount(prev => prev + 1);

    if (inputRef.current) inputRef.current.style.height = 'auto';

    const history = messages
      .filter(m => m.id !== '1')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const byokKey = getActiveProviderKey(selectedModel);
      const personality = loadPersonality();
      const personalityPrefix = buildPersonalityPrefix(personality);
      await sendChat(token, userMsg.content, history, selectedModel, (text) => {
        setMessages(prev => prev.map(m =>
          m.id === avaMsg.id ? { ...m, content: m.content + text } : m
        ));
      }, byokKey, personalityPrefix);
    } catch (err: any) {
      const friendlyError = getFriendlyError(err.message);
      setMessages(prev => prev.map(m =>
        m.id === avaMsg.id
          ? { ...m, content: friendlyError }
          : m
      ));
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
      // Refresh token balance + usage warning after each message
      fetchTokenBalance();
    }
  }, [input, streaming, messages, selectedModel, token]);

  return {
    // State
    messages,
    input,
    streaming,
    selectedModel,
    showModelPicker,
    showHistory,
    conversations,
    conversationId,
    messageCount,
    nudgeDismissed,
    showNudge,
    offlineBanner,
    usageWarning,
    tokenBalance,
    greeting,
    // Refs
    messagesEndRef,
    inputRef,
    // Setters
    setInput,
    setSelectedModel,
    setShowModelPicker,
    setShowHistory,
    setConversations,
    setNudgeDismissed,
    setMessages,
    setOfflineBanner,
    // Actions
    sendMessage,
    startNewChat,
    handleDeleteConversation,
    loadConversation,
  };
}
