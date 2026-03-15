'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sendChat, MODELS } from '@/lib/api';
import TasksPanel from './TasksPanel';
import JournalPanel from './JournalPanel';
import AuthPage from './AuthPage';
import WelcomeFlow from './WelcomeFlow';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type MobileView = 'chat' | 'tasks' | 'journal' | 'settings';

const NUDGE_AFTER_MESSAGES = 6;

export default function CompanionApp({
  session,
  onSignIn,
  onSignOut,
}: {
  session: Session | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  // Auth state — session OR API key
  const [apiKey, setApiKey] = useState<string | null>(null);
  const isGuest = !session && !apiKey;
  const userName = session?.user.user_metadata?.full_name?.split(' ')[0] || 'there';
  const token = session?.access_token ?? apiKey;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: isGuest
        ? "Hey! I'm Ava — your AI companion. I'm ready to chat using our free models, no sign up needed.\n\nWhat's on your mind?"
        : `Hey ${userName}! I'm Ava — your companion on the go. I can manage your tasks, write journal entries, and chat about anything.\n\nWhat's on your mind?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('glm-4-flash');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [showSidePanel, setShowSidePanel] = useState<'none' | 'tasks' | 'journal'>('none');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Show welcome flow for newly signed-in users who haven't seen it
  useEffect(() => {
    if (!isGuest && typeof window !== 'undefined') {
      const welcomed = localStorage.getItem('ava-companion-welcomed');
      if (!welcomed) {
        setShowWelcome(true);
      }
    }
  }, [isGuest]);

  const showNudge = isGuest && messageCount >= NUDGE_AFTER_MESSAGES && !nudgeDismissed;

  const handleApiKeyConnect = (key: string) => {
    setApiKey(key);
    setShowAuthModal(false);
    // Update greeting
    setMessages([{
      id: '1',
      role: 'assistant',
      content: "Connected! I now have access to your tasks, journal, and memories. What would you like to do?",
      timestamp: new Date(),
    }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const avaMsg: Message = {
      id: (Date.now() + 1).toString(),
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
      await sendChat(token, userMsg.content, history, selectedModel, (text) => {
        setMessages(prev => prev.map(m =>
          m.id === avaMsg.id ? { ...m, content: m.content + text } : m
        ));
      });
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === avaMsg.id
          ? { ...m, content: `Sorry, I couldn't connect. ${err.message || 'Please try again.'}` }
          : m
      ));
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleMobileNav = (view: MobileView) => {
    if ((view === 'tasks' || view === 'journal') && isGuest) {
      setShowAuthModal(true);
      return;
    }
    setMobileView(view);
  };

  const toggleDesktopPanel = (panel: 'tasks' | 'journal') => {
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }
    setShowSidePanel(prev => prev === panel ? 'none' : panel);
  };

  const selectModel = (modelId: string) => {
    const model = MODELS.find(m => m.id === modelId);
    if (model && !model.free && isGuest) {
      setShowAuthModal(true);
      return;
    }
    setSelectedModel(modelId);
    setShowModelPicker(false);
  };

  const currentModel = MODELS.find(m => m.id === selectedModel);

  return (
    <div className="h-dvh flex flex-col bg-ava-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-ava-border shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Ava</h1>
            <p className="text-[10px] text-ava-purple font-medium tracking-[0.2em] uppercase">Companion</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1" />
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ava-surface border border-ava-border text-sm text-gray-300 hover:border-ava-purple transition"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${currentModel?.free ? 'bg-emerald-400' : 'bg-ava-purple'}`} />
              <span className="max-w-[120px] truncate">{currentModel?.name || selectedModel}</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showModelPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowModelPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-ava-surface border border-ava-border rounded-xl shadow-xl z-20 min-w-[240px] py-1 max-h-[400px] overflow-y-auto">
                  {MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => selectModel(model.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-ava-surface-hover transition ${
                        selectedModel === model.id ? 'bg-ava-purple/10' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${model.free ? 'bg-emerald-400' : 'bg-ava-purple'}`} />
                          <span className="text-sm text-white">{model.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 ml-3.5">{model.provider}</span>
                      </div>
                      {model.free ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">FREE</span>
                      ) : isGuest ? (
                        <span className="text-[10px] text-gray-500">Sign in</span>
                      ) : (
                        selectedModel === model.id && <span className="text-ava-purple">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Desktop-only: Tasks button */}
          <button
            onClick={() => toggleDesktopPanel('tasks')}
            className={`hidden md:block p-2 rounded-lg transition relative ${
              showSidePanel === 'tasks' ? 'bg-ava-purple text-white' :
              isGuest ? 'text-gray-600 hover:text-gray-400' :
              'text-gray-400 hover:text-white hover:bg-ava-surface'
            }`}
            title={isGuest ? 'Sign in to use Tasks' : 'Tasks'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {isGuest && <LockBadge />}
          </button>

          {/* Desktop-only: Journal button */}
          <button
            onClick={() => toggleDesktopPanel('journal')}
            className={`hidden md:block p-2 rounded-lg transition relative ${
              showSidePanel === 'journal' ? 'bg-ava-purple text-white' :
              isGuest ? 'text-gray-600 hover:text-gray-400' :
              'text-gray-400 hover:text-white hover:bg-ava-surface'
            }`}
            title={isGuest ? 'Sign in to use Journal' : 'Journal'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {isGuest && <LockBadge />}
          </button>
        </div>
      </header>

      {/* Nudge banner */}
      {showNudge && (
        <div className="shrink-0 bg-ava-purple/10 border-b border-ava-purple/20 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-gray-300">
            <span className="text-ava-purple-light font-medium">Enjoying Ava?</span>{' '}
            <span className="hidden sm:inline">Create a free account for memory, tasks, journal, and 14 models.</span>
            <span className="sm:hidden">Sign up free for the full experience.</span>
          </p>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-medium text-white bg-ava-purple px-3 py-1 rounded-lg hover:bg-ava-purple-dark transition"
            >
              Sign Up
            </button>
            <button onClick={() => setNudgeDismissed(true)} className="text-gray-500 hover:text-gray-300 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Main view — switches between chat/tasks/journal/settings on mobile */}
        <div className="flex-1 flex flex-col min-w-0">
          {mobileView === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-ava-purple text-white rounded-br-sm'
                        : 'bg-ava-surface border border-ava-border rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">Ava</span>
                          <span className="text-[9px] font-bold text-ava-purple-light bg-ava-purple-dark/40 px-1.5 py-0.5 rounded tracking-wider">SUPERNOVA</span>
                        </div>
                      )}
                      <div className="message-content text-[15px] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                        {streaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id && msg.content && (
                          <span className="text-ava-purple animate-pulse">▊</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1 text-right">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-ava-border p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Ava..."
                    disabled={streaming}
                    rows={1}
                    className="flex-1 bg-ava-surface border border-ava-border rounded-2xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none resize-none text-[15px] max-h-[120px] disabled:opacity-50 transition"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || streaming}
                    className="shrink-0 w-10 h-10 bg-ava-purple rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-ava-purple-dark transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : mobileView === 'tasks' && token ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-ava-border">
                <h2 className="font-semibold text-white text-lg">Tasks</h2>
              </div>
              <TasksPanel token={token} />
            </div>
          ) : mobileView === 'journal' && token ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-ava-border">
                <h2 className="font-semibold text-white text-lg">Journal</h2>
              </div>
              <JournalPanel token={token} />
            </div>
          ) : mobileView === 'settings' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h2 className="font-semibold text-white text-lg">Settings</h2>

              {isGuest ? (
                <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
                  <p className="text-sm text-gray-300">You&apos;re using Ava as a guest with free models.</p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2.5 rounded-xl transition text-sm"
                  >
                    Sign In / Create Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ava-purple flex items-center justify-center text-white font-bold">
                        {(session?.user.user_metadata?.full_name?.[0] || session?.user.email?.[0] || 'A').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{session?.user.user_metadata?.full_name || 'Connected'}</p>
                        <p className="text-xs text-gray-500">{session?.user.email || (apiKey ? 'API Key connected' : '')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Memory</span>
                      <span className="text-emerald-400">Synced</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tasks</span>
                      <span className="text-emerald-400">Synced</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Journal</span>
                      <span className="text-emerald-400">Synced</span>
                    </div>
                  </div>

                  <button
                    onClick={() => { apiKey ? setApiKey(null) : onSignOut(); setMobileView('chat'); }}
                    className="w-full bg-ava-surface border border-ava-border text-red-400 font-medium py-2.5 rounded-xl hover:bg-red-400/10 transition text-sm"
                  >
                    {apiKey ? 'Disconnect API Key' : 'Sign Out'}
                  </button>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <a href="https://github.com/AugmentedValueAcceleration/ava-supernova" target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-gray-400 hover:text-white transition">GitHub</a>
                <a href="https://ava-supernova.com" target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-gray-400 hover:text-white transition">Website</a>
                <p className="text-xs text-gray-600 pt-2">Ava Companion v0.1.0 — Apache 2.0</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Desktop side panel */}
        {showSidePanel !== 'none' && token && (
          <div className="hidden md:flex w-80 border-l border-ava-border shrink-0 flex-col bg-ava-bg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ava-border">
              <h2 className="font-semibold text-white">
                {showSidePanel === 'tasks' ? 'Tasks' : 'Journal'}
              </h2>
              <button onClick={() => setShowSidePanel('none')} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {showSidePanel === 'tasks' && <TasksPanel token={token} />}
              {showSidePanel === 'journal' && <JournalPanel token={token} />}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom nav — thumb-friendly */}
      <nav className="md:hidden shrink-0 border-t border-ava-border bg-ava-surface flex items-center justify-around py-2 safe-area-bottom">
        <ThumbButton
          icon={<ChatIcon />}
          label="Chat"
          active={mobileView === 'chat'}
          onClick={() => setMobileView('chat')}
        />
        <ThumbButton
          icon={<TasksIcon />}
          label="Tasks"
          active={mobileView === 'tasks'}
          locked={isGuest}
          onClick={() => handleMobileNav('tasks')}
        />
        <ThumbButton
          icon={<JournalIcon />}
          label="Journal"
          active={mobileView === 'journal'}
          locked={isGuest}
          onClick={() => handleMobileNav('journal')}
        />
        <ThumbButton
          icon={<SettingsIcon />}
          label="Settings"
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
              onSignIn={() => { setShowAuthModal(false); onSignIn(); }}
              onApiKeyConnect={handleApiKeyConnect}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Thumb menu button
function ThumbButton({ icon, label, active, locked, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; locked?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 px-4 py-1 relative transition ${active ? 'text-ava-purple' : locked ? 'text-gray-600' : 'text-gray-400'}`}>
      <div className="relative">
        {icon}
        {locked && <LockBadge />}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function LockBadge() {
  return (
    <svg className="w-2.5 h-2.5 absolute -top-0.5 -right-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

// Icons
function ChatIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
}
function TasksIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function JournalIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function SettingsIcon() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
