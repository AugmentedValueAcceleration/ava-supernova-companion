'use client';

import { useState, useRef, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MODELS } from '@/lib/api';
import { t } from '@/lib/i18n';
import { getConversations, clearAllConversations } from '@/lib/chat-history';
import { useChat } from '@/lib/useChat';
import { requestNotificationPermission, startTaskNotifications } from '@/lib/notifications';
import { Markdown } from './Markdown';
import TasksPanel from './TasksPanel';
import JournalPanel from './JournalPanel';
import MemoryPanel from './MemoryPanel';
// LearningPanel removed — teaching needs the full extension toolkit
import AuthPage from './AuthPage';
import WelcomeFlow from './WelcomeFlow';
import SettingsView from './SettingsView';
import PersonalityDesigner from './PersonalityDesigner';
import ConfirmDialog from './ConfirmDialog';
import { loadPersonality } from '@/lib/personality';

type MobileView = 'chat' | 'tasks' | 'journal' | 'memory' | 'settings' | 'personality';

export default function CompanionApp({
  session,
  onSignIn,
  onSignOut,
}: {
  session: Session | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  // Auth state — session OR API key (persisted to localStorage)
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('ava-companion-api-key');
    return null;
  });
  const setApiKey = (key: string | null) => {
    setApiKeyState(key);
    if (key) localStorage.setItem('ava-companion-api-key', key);
    else localStorage.removeItem('ava-companion-api-key');
  };
  const isGuest = !session && !apiKey;
  const userName = session?.user.user_metadata?.full_name?.split(' ')[0] || 'there';
  const token = session?.access_token ?? apiKey;

  // Chat hook
  const chat = useChat({ session, token, isGuest, userName });

  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Ava's name is fixed — not user-configurable
  const personalityName = 'Ava';

  const [textSize, setTextSize] = useState<'small' | 'default' | 'large'>(() => {
    if (typeof window !== 'undefined') {
      try { const s = JSON.parse(localStorage.getItem('ava-companion-settings') || '{}'); return s.textSize || 'default'; } catch { return 'default'; }
    }
    return 'default';
  });

  // Confirm dialog for delete conversation
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  // Apply theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('ava-companion-settings');
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (s.theme === 'light') {
          document.documentElement.classList.add('light');
        } else if (s.theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('light', !prefersDark);
        } else {
          document.documentElement.classList.remove('light');
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Listen for text size changes from settings
  useEffect(() => {
    const handler = () => {
      try {
        const s = JSON.parse(localStorage.getItem('ava-companion-settings') || '{}');
        if (s.textSize) setTextSize(s.textSize);
        if (s.theme === 'light') {
          document.documentElement.classList.add('light');
        } else if (s.theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('light', !prefersDark);
        } else {
          document.documentElement.classList.remove('light');
        }
      } catch { /* ignore */ }
    };
    const personalityHandler = () => {
      // Personality style may have changed but name stays Ava
    };
    window.addEventListener('storage', handler);
    window.addEventListener('ava-settings-changed', handler);
    window.addEventListener('ava-personality-changed', personalityHandler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ava-settings-changed', handler);
      window.removeEventListener('ava-personality-changed', personalityHandler);
    };
  }, []);

  // Detect mobile keyboard open/close via visualViewport
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      // If viewport height is significantly less than window height, keyboard is open
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const textSizeClass = textSize === 'small' ? 'text-[13px]' : textSize === 'large' ? 'text-[17px]' : 'text-[15px]';

  // Version check — poll every 5 minutes
  useEffect(() => {
    const APP_VERSION = '0.1.1';

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== APP_VERSION) {
            setUpdateAvailable(true);
          }
        }
      } catch { /* ignore */ }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  // Auto-focus input on chat view
  useEffect(() => {
    if (mobileView === 'chat') {
      const timer = setTimeout(() => chat.inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [mobileView]);

  // Notification setup — request permission and start checking on mount
  useEffect(() => {
    startTaskNotifications();
  }, []);

  const handleNewChat = () => {
    chat.startNewChat();
    setMobileView('chat');
  };

  // Show welcome flow for newly signed-in users who haven't seen it
  useEffect(() => {
    if (!isGuest && typeof window !== 'undefined') {
      const welcomed = localStorage.getItem('ava-companion-welcomed');
      if (!welcomed) {
        setShowWelcome(true);
      }
    }
  }, [isGuest]);

  const handleApiKeyConnect = (key: string) => {
    setApiKey(key);
    setShowAuthModal(false);
    chat.setMessages([{
      id: '1',
      role: 'assistant',
      content: "Connected! I now have access to your tasks, journal, and memories. What would you like to do?",
      timestamp: new Date(),
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chat.sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    chat.setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showMicPrompt, setShowMicPrompt] = useState(false);

  // Check mic permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
        result.onchange = () => setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
      }).catch(() => {});
    }
    const consent = localStorage.getItem('ava-companion-mic-consent');
    if (consent === 'granted') setMicPermission('granted');
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    let finalTranscript = '';

    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      chat.setInput(prev => {
        const base = prev.replace(/\u200B.*$/, '').trimEnd();
        const combined = (base ? base + ' ' : '') + finalTranscript + interim;
        return combined;
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      chat.inputRef.current?.focus();
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      recognitionRef.current = null;
      if (e.error === 'not-allowed') {
        setMicPermission('denied');
        localStorage.setItem('ava-companion-mic-consent', 'denied');
      }
    };

    recognitionRef.current = recognition;
    finalTranscript = '';
    recognition.start();
    setIsListening(true);
    localStorage.setItem('ava-companion-mic-consent', 'granted');
    setMicPermission('granted');
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (micPermission === 'prompt' && !localStorage.getItem('ava-companion-mic-consent')) {
      setShowMicPrompt(true);
      return;
    }

    if (micPermission === 'denied') return;

    startListening();
  };

  const selectModel = (modelId: string) => {
    const model = MODELS.find(m => m.id === modelId);
    if (model && !model.free && isGuest) {
      setShowAuthModal(true);
      return;
    }
    chat.setSelectedModel(modelId);
    localStorage.setItem('ava-companion-model', modelId);
    chat.setShowModelPicker(false);
  };

  const currentModel = MODELS.find(m => m.id === chat.selectedModel);

  // Request notification permission on first task creation
  const handleTaskNav = () => {
    setMobileView('tasks');
    // Request notification permission when user first visits tasks
    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission();
    }
  };

  return (
    <div className={`h-dvh flex flex-col bg-ava-bg md:pb-0 ${keyboardOpen ? 'pb-0' : 'pb-14'}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-ava-border shrink-0">
        {/* Left: Logo + New Chat + History */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{personalityName}</h1>
            <p className="text-[10px] text-ava-purple font-medium tracking-[0.2em] uppercase">Companion</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1" />

          {/* New chat */}
          <button
            onClick={handleNewChat}
            className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-ava-surface transition"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* History */}
          <button
            onClick={() => { chat.setConversations(getConversations()); chat.setShowHistory(!chat.showHistory); }}
            className={`p-1.5 rounded-lg transition ${chat.showHistory ? 'bg-ava-purple text-white' : 'text-gray-400 hover:text-white hover:bg-ava-surface'}`}
            title="Chat history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Center: Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-ava-surface rounded-xl p-1" aria-label="Main navigation">
          {([
            { key: 'chat' as MobileView, label: t('chat'), icon: <ChatIcon /> },
            { key: 'tasks' as MobileView, label: t('tasks'), icon: <TasksIconSm /> },
            { key: 'memory' as MobileView, label: t('memory'), icon: <MemoryIconSm /> },
            { key: 'journal' as MobileView, label: t('journal'), icon: <JournalIconSm /> },
            { key: 'personality' as MobileView, label: t('personality'), icon: <PersonalityIconSm /> },
            { key: 'settings' as MobileView, label: t('settings'), icon: <SettingsIconSm /> },
          ]).map(item => (
            <button
              key={item.key}
              onClick={() => item.key === 'tasks' ? handleTaskNav() : setMobileView(item.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                mobileView === item.key
                  ? 'bg-ava-purple text-white'
                  : 'text-gray-400 hover:text-white hover:bg-ava-surface-hover'
              }`}
              aria-current={mobileView === item.key ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Token balance + Model selector + Sign In */}
        <div className="flex items-center gap-2">
          {/* Token balance pill */}
          {chat.tokenBalance && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium"
              style={{
                background: chat.tokenBalance.used / chat.tokenBalance.limit > 0.9
                  ? 'rgba(239,68,68,0.15)' : 'rgba(168,85,247,0.1)',
                color: chat.tokenBalance.used / chat.tokenBalance.limit > 0.9
                  ? '#f87171' : '#c084fc',
                border: `1px solid ${chat.tokenBalance.used / chat.tokenBalance.limit > 0.9
                  ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.15)'}`,
              }}
              title={`${((chat.tokenBalance.limit - chat.tokenBalance.used) / 1_000_000).toFixed(1)}M tokens remaining`}
            >
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
              {((chat.tokenBalance.limit - chat.tokenBalance.used) / 1_000_000).toFixed(1)}M
            </div>
          )}
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => chat.setShowModelPicker(!chat.showModelPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ava-surface border border-ava-border text-sm text-gray-300 hover:border-ava-purple transition"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${currentModel?.free ? 'bg-emerald-400' : 'bg-ava-purple'}`} />
              <span className="max-w-[120px] truncate">{currentModel?.name || chat.selectedModel}</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {chat.showModelPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => chat.setShowModelPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-ava-surface border border-ava-border rounded-xl shadow-xl z-20 min-w-[240px] py-1 max-h-[400px] overflow-y-auto">
                  {MODELS.filter(model => {
                    // Hide account-required models for guests
                    if (isGuest && model.requiresAccount) return false;
                    return true;
                  }).map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        if (isGuest && !model.free) return; // Can't select BYOK without keys
                        selectModel(model.id);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-ava-surface-hover transition ${
                        chat.selectedModel === model.id ? 'bg-ava-purple/10' : ''
                      } ${isGuest && !model.free ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${model.free ? 'bg-emerald-400' : 'bg-ava-purple'}`} />
                          <span className="text-sm text-white">{model.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 ml-3.5">{model.provider}</span>
                      </div>
                      {model.free && !isGuest ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">FREE</span>
                      ) : isGuest ? (
                        <span className="text-[10px] text-gray-500">API key</span>
                      ) : (
                        chat.selectedModel === model.id && <span className="text-ava-purple">&#10003;</span>
                      )}
                    </button>
                  ))}{isGuest && (
                    <div className="px-3 py-2 border-t border-ava-border mt-1">
                      <p className="text-[11px] text-gray-400 text-center">Sign up for 3M free Qwen tokens</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sign in button for guests — desktop */}
          {isGuest && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="hidden md:block px-3 py-1.5 rounded-lg bg-ava-purple text-white text-sm font-medium hover:bg-ava-purple-dark transition"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Update banner */}
      {updateAvailable && (
        <div className="shrink-0 bg-ava-purple/10 border-b border-ava-purple/20 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-gray-300">
            <span className="text-ava-purple-light font-medium">Update available</span>{' '}
            — new features and improvements
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-medium text-white bg-ava-purple px-3 py-1 rounded-lg hover:bg-ava-purple-dark transition shrink-0 ml-3"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Offline banner */}
      {chat.offlineBanner && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-amber-300">
            {t('offlineQueued')}
          </p>
          <button onClick={() => chat.setOfflineBanner(false)} className="text-gray-500 hover:text-gray-300 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Usage warning banner */}
      {chat.usageWarning.level !== 'none' && chat.usageWarning.message && (
        <div className={`shrink-0 px-4 py-2.5 flex items-center gap-2 border-b text-sm ${
          chat.usageWarning.level === 'exhausted' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
          chat.usageWarning.level === 'critical' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
          'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <span>{chat.usageWarning.level === 'exhausted' ? '\u26D4' : chat.usageWarning.level === 'critical' ? '\u26A0' : '\u25CB'}</span>
          <span className="flex-1">{chat.usageWarning.message}</span>
        </div>
      )}

      {/* Nudge banner */}
      {chat.showNudge && (
        <div className="shrink-0 bg-ava-purple/10 border-b border-ava-purple/20 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-gray-300">
            <span className="text-ava-purple-light font-medium">Enjoying Ava?</span>{' '}
            <span className="hidden sm:inline">Create a free account for memory, tasks, journal, and 12 models.</span>
            <span className="sm:hidden">Sign up free for the full experience.</span>
          </p>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-medium text-white bg-ava-purple px-3 py-1 rounded-lg hover:bg-ava-purple-dark transition"
            >
              Sign Up
            </button>
            <button onClick={() => chat.setNudgeDismissed(true)} className="text-gray-500 hover:text-gray-300 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* History — full overlay on mobile, side drawer on desktop */}
        {chat.showHistory && (
          <>
            {/* Mobile: full screen overlay */}
            <div className="md:hidden absolute inset-0 z-30 flex flex-col bg-ava-bg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-ava-border">
                <h2 className="font-semibold text-white text-lg">{t('chatHistory')}</h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleNewChat} className="text-sm text-ava-purple font-medium">{t('newChat')}</button>
                  <button onClick={() => chat.setShowHistory(false)} className="text-gray-400 hover:text-white transition">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chat.conversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <p className="text-sm">{t('noConversations')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('startChatting')}</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {chat.conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition border-b border-ava-border/50 ${
                          conv.id === chat.conversationId ? 'bg-ava-surface' : 'active:bg-ava-surface/50'
                        }`}
                        onClick={() => { chat.loadConversation(conv.id); setMobileView('chat'); }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{conv.title}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {new Date(conv.updatedAt).toLocaleDateString()} · {conv.messages.length} messages
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: conv.id }); }}
                          className="p-2 text-gray-500 hover:text-red-400 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: side drawer */}
            <div className="hidden md:flex w-72 border-r border-ava-border shrink-0 flex-col bg-ava-bg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-ava-border">
                <h2 className="font-semibold text-white text-sm">History</h2>
                <button onClick={handleNewChat} className="text-xs text-ava-purple hover:underline">New chat</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chat.conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No conversations yet</div>
                ) : (
                  <div className="py-1">
                    {chat.conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer transition ${
                          conv.id === chat.conversationId ? 'bg-ava-surface' : 'hover:bg-ava-surface/50'
                        }`}
                        onClick={() => { chat.loadConversation(conv.id); setMobileView('chat'); }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{conv.title}</p>
                          <p className="text-[11px] text-gray-500">
                            {new Date(conv.updatedAt).toLocaleDateString()} · {conv.messages.length} messages
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: conv.id }); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Main view — switches between chat/tasks/journal/learning/settings on mobile */}
        <div className="flex-1 flex flex-col min-w-0">
          {mobileView === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 md:px-8 lg:px-12">
                {chat.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[80%] md:max-w-[700px] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-ava-purple text-white rounded-br-sm'
                        : 'bg-ava-surface border border-ava-border rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">{personalityName}</span>
                          <span className="text-[9px] font-bold text-ava-purple-light bg-ava-purple-dark/40 px-1.5 py-0.5 rounded tracking-wider">SUPERNOVA</span>
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        <div className={`${textSizeClass} leading-relaxed`}>
                          <Markdown content={msg.content} />
                          {chat.streaming && msg.id === chat.messages[chat.messages.length - 1]?.id && msg.content && (
                            <span className="text-ava-purple animate-pulse">&#9610;</span>
                          )}
                        </div>
                      ) : (
                        <div className={`${textSizeClass} leading-relaxed whitespace-pre-wrap`}>
                          {msg.content}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500 mt-1 text-right">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chat.messagesEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-ava-border p-3 md:px-8 lg:px-12">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={chat.inputRef}
                    value={chat.input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={t('messagePlaceholder')}
                    disabled={chat.streaming}
                    autoFocus
                    rows={1}
                    className={`flex-1 bg-ava-surface border border-ava-border rounded-2xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none resize-none ${textSizeClass} max-h-[120px] disabled:opacity-50 transition`}
                  />
                  {/* Voice input */}
                  <button
                    onClick={toggleVoice}
                    disabled={chat.streaming || micPermission === 'denied'}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : micPermission === 'denied'
                        ? 'bg-ava-surface border border-ava-border text-gray-600 cursor-not-allowed'
                        : 'bg-ava-surface border border-ava-border text-gray-400 hover:text-white hover:border-ava-purple'
                    } disabled:opacity-30`}
                    title={micPermission === 'denied' ? 'Microphone access denied — check browser settings' : isListening ? 'Stop listening' : 'Voice input'}
                  >
                    {micPermission === 'denied' ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>

                  {/* Send */}
                  <button
                    onClick={chat.sendMessage}
                    disabled={!chat.input.trim() || chat.streaming}
                    className="shrink-0 w-10 h-10 bg-ava-purple rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-ava-purple-dark transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : mobileView === 'tasks' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full">
                <div className="px-4 py-3 border-b border-ava-border flex items-center justify-between">
                  <h2 className="font-semibold text-white text-lg">{t('tasks')}</h2>
                  {isGuest && <span className="text-[10px] text-gray-500">{t('localOnly')}</span>}
                </div>
                <TasksPanel token={token} />
              </div>
            </div>
          ) : mobileView === 'journal' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full">
                <div className="px-4 py-3 border-b border-ava-border flex items-center justify-between">
                  <h2 className="font-semibold text-white text-lg">{t('journal')}</h2>
                  {isGuest && <span className="text-[10px] text-gray-500">{t('localOnly')}</span>}
                </div>
                <JournalPanel token={token} />
              </div>
            </div>
          ) : mobileView === 'memory' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full">
                <div className="px-4 py-3 border-b border-ava-border flex items-center justify-between">
                  <h2 className="font-semibold text-white text-lg">{t('memory')}</h2>
                  {isGuest && <span className="text-[10px] text-gray-500">{t('localOnly')}</span>}
                </div>
                <MemoryPanel token={token} />
              </div>
            </div>
          ) : mobileView === 'personality' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto w-full">
                <PersonalityDesigner />
              </div>
            </div>
          ) : mobileView === 'settings' ? (
            <SettingsView
              isGuest={isGuest}
              session={session}
              apiKey={apiKey}
              selectedModel={chat.selectedModel}
              onSelectModel={(id) => { chat.setSelectedModel(id); localStorage.setItem('ava-companion-model', id); }}
              onSignIn={() => setShowAuthModal(true)}
              onSignOut={() => { if (apiKey) { setApiKey(null); } else { onSignOut(); } setMobileView('chat'); }}
              onClearChat={() => { clearAllConversations(); handleNewChat(); }}
              onNavigatePersonality={() => setMobileView('personality')}
            />
          ) : null}
        </div>

      </div>

      {/* Mobile bottom nav — thumb-friendly, hidden when keyboard is open */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-ava-border bg-ava-surface flex items-center justify-around py-2 safe-area-bottom transition-transform duration-200 ${keyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}>
        <ThumbButton
          icon={<TasksIcon />}
          label={t('tasks')}
          active={mobileView === 'tasks'}
          onClick={handleTaskNav}
        />
        <ThumbButton
          icon={<MemoryIcon />}
          label={t('memory')}
          active={mobileView === 'memory'}
          onClick={() => setMobileView('memory')}
        />
        <ThumbButton
          icon={<ChatIcon />}
          label={t('chat')}
          active={mobileView === 'chat'}
          onClick={() => setMobileView('chat')}
          primary
        />
        <ThumbButton
          icon={<JournalIcon />}
          label={t('journal')}
          active={mobileView === 'journal'}
          onClick={() => setMobileView('journal')}
        />
        <ThumbButton
          icon={<SettingsIcon />}
          label={t('settings')}
          active={mobileView === 'settings'}
          onClick={() => setMobileView('settings')}
        />
      </nav>

      {/* Welcome flow for new signups */}
      {showWelcome && (
        <WelcomeFlow
          userName={userName}
          onComplete={() => {
            setShowWelcome(false);
            localStorage.setItem('ava-companion-welcomed', 'true');
          }}
        />
      )}

      {/* Mic permission prompt */}
      {showMicPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-ava-surface border border-ava-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ava-purple/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-ava-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Voice Input</h3>
                <p className="text-xs text-gray-400">Speak instead of typing</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Ava can listen to your voice and convert it to text. Your audio is processed entirely by your browser — <strong className="text-white">nothing is recorded, stored, or sent to any server</strong>.
            </p>
            <p className="text-xs text-gray-500">
              You can revoke microphone access at any time in your browser settings.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowMicPrompt(false); startListening(); }}
                className="flex-1 bg-ava-purple text-white font-medium py-2.5 rounded-xl hover:bg-ava-purple-dark transition text-sm"
              >
                Allow Microphone
              </button>
              <button
                onClick={() => { setShowMicPrompt(false); localStorage.setItem('ava-companion-mic-consent', 'denied'); setMicPermission('denied'); }}
                className="flex-1 bg-ava-border text-gray-300 font-medium py-2.5 rounded-xl hover:bg-gray-600 transition text-sm"
              >
                No Thanks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white transition"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <AuthPage
              onApiKeyConnect={(key) => { setShowAuthModal(false); handleApiKeyConnect(key); }}
            />
          </div>
        </div>
      )}

      {/* Delete conversation confirm dialog */}
      <ConfirmDialog
        open={confirmDelete.open}
        title={t('confirmDelete')}
        message={t('confirmDeleteMsg')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        destructive
        onConfirm={() => {
          chat.handleDeleteConversation(confirmDelete.id);
          setConfirmDelete({ open: false, id: '' });
        }}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
    </div>
  );
}

// Thumb menu button
function ThumbButton({ icon, label, active, onClick, primary }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; primary?: boolean;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 px-3 py-1 transition ${primary ? 'scale-[1.15] -mt-1' : ''} ${active ? 'text-ava-purple' : 'text-gray-400'}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// Icons
function ChatIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
}
function TasksIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function MemoryIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>;
}
function JournalIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function SettingsIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}

// Small icons for desktop header nav
function TasksIconSm() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function MemoryIconSm() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}
function JournalIconSm() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function PersonalityIconSm() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
}
function SettingsIconSm() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
