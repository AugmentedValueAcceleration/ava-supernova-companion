'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sendChat, apiFetch, MODELS, getProviderSource } from '@/lib/api';
import { t } from '@/lib/i18n';
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
  /** Tools Ava used on this turn, in call order — shown as pills so the user
   *  can see what she's doing (web search, tasks, journal, etc.), like the IDE. */
  tools?: Array<{ name: string; done?: boolean }>;
}

const NUDGE_AFTER_MESSAGES = 6;

function getFriendlyError(message?: string): string {
  const msg = (message || '').toLowerCase();

  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('err_internet'))
    return "Looks like you're offline. Check your connection and try again.";

  // Out of credits / plan allowance. The backend sends this as 429 with an
  // allowance message ("...credit allowance reached/exhausted", "Credit limit
  // reached"), so it MUST be caught BEFORE the generic 429 branch below — else
  // a lapsed or exhausted account is wrongly told it's "sending too fast",
  // which is why it read as no real feedback. Now that the wallet toggle
  // exists, API Key mode is the instant fallback that doesn't cost credits.
  if (msg.includes('credit') || msg.includes('allowance') || msg.includes('top-up') || msg.includes('token limit') || msg.includes('limit reached'))
    return "You're out of credits this month. Top up or upgrade at avasupernova.com/pricing — or switch to API Key in the model picker to keep going on your own key.";

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many'))
    return "You're sending messages a bit fast — give it a moment and try again.";

  if (msg.includes('401') || msg.includes('not authenticated') || msg.includes('invalid api key'))
    return "Your session expired. Try signing in again from Settings.";

  if (msg.includes('403') || msg.includes('not available on your plan') || msg.includes('no api key'))
    return "No API key or account detected. Sign up for 300 free credits a month, or add your own API key in Settings.";

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
  // Ava's opening line follows the chosen language, like every other surface.
  // Her replies already did (the locale rides on X-Ava-Language every turn);
  // only this greeting was hardcoded English, so she introduced herself in the
  // wrong language and then switched — the most visible seam in the app.
  const greeting: Message = {
    id: '1', role: 'assistant', timestamp: new Date(),
    content: isGuest
      ? t('greetingGuest')
      : t('greetingUser').replace('{name}', userName),
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
    // Default to the flagship fleet (Maestro). Plan users only ever get the
    // four fleets, so a single model is never a valid default for them.
    if (typeof window === 'undefined') return 'auto';
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
    return 'auto';
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

  // Fetch token balance on mount and expose for header display. Unified
  // total — backend burns free pool first and overflows to the subscription
  // pool, but the header shows one combined number so the user doesn't
  // have to mentally sum them.
  const fetchTokenBalance = useCallback(() => {
    if (!token) return;
    apiFetch('/account-info', {}, token).then(r => r.json()).then(data => {
      if (data?.usage) {
        const tier = data.tier || 'free';
        const used = (data.usage.free_credits_used || 0) + (data.usage.credits_used || 0);
        const limit = (data.usage.free_credits_limit || 0) + (data.usage.credits_limit || 0);
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
          // Only send the BYOK key when the user is in API Key mode — in
          // Platform mode the turn runs on credits even if a key is stored.
          const byokKey = getProviderSource() === 'byok' ? getActiveProviderKey(item.model) : null;
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
      // Only send the BYOK key in API Key mode; Platform mode runs on credits.
      const byokKey = getProviderSource() === 'byok' ? getActiveProviderKey(selectedModel) : null;
      const personality = loadPersonality();
      const personalityPrefix = buildPersonalityPrefix(personality);
      await sendChat(token, userMsg.content, history, selectedModel, (text) => {
        setMessages(prev => prev.map(m =>
          m.id === avaMsg.id ? { ...m, content: m.content + text } : m
        ));
      }, byokKey, personalityPrefix, (evt) => {
        // Show which tools Ava uses this turn. tool_call adds a pill; tool_result
        // marks the first matching pending one done.
        const name = typeof evt.tool === 'string' ? evt.tool : undefined;
        if (!name) return;
        setMessages(prev => prev.map(m => {
          if (m.id !== avaMsg.id) return m;
          const tools = m.tools ?? [];
          if (evt.type === 'tool_call') return { ...m, tools: [...tools, { name }] };
          let marked = false;
          return { ...m, tools: tools.map(t => (!marked && t.name === name && !t.done ? (marked = true, { ...t, done: true }) : t)) };
        }));
      });
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

  // Sign-out reset. Clearing localStorage alone left in-memory state behind —
  // most visibly the credit balance, which kept showing the signed-in number
  // after logout. Wipe every piece of session state back to a true logged-out
  // shell so the two states can't blend into each other.
  const resetForSignOut = useCallback(() => {
    setMessages([greeting]);
    setInput('');
    setConversationId(null);
    setConversations([]);
    setTokenBalance(null);
    setUsageWarning({ level: 'none', message: '' });
    setMessageCount(0);
    setShowModelPicker(false);
    setShowHistory(false);
    setSelectedModel('');
  }, [greeting]);

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
    resetForSignOut,
  };
}
