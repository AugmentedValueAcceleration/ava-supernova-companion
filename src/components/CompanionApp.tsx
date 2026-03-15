'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sendChat, MODELS } from '@/lib/api';
import TasksPanel from './TasksPanel';
import JournalPanel from './JournalPanel';
import AuthPage from './AuthPage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type SidePanel = 'none' | 'tasks' | 'journal';

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
  const isGuest = !session;
  const userName = session?.user.user_metadata?.full_name?.split(' ')[0] || 'there';
  const token = session?.access_token ?? null;

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
  const [sidePanel, setSidePanel] = useState<SidePanel>('none');
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const showNudge = isGuest && messageCount >= NUDGE_AFTER_MESSAGES && !nudgeDismissed;

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

  const togglePanel = (panel: SidePanel) => {
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }
    setSidePanel(prev => prev === panel ? 'none' : panel);
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

          {/* Tasks button */}
          <button
            onClick={() => togglePanel('tasks')}
            className={`p-2 rounded-lg transition relative ${
              sidePanel === 'tasks' ? 'bg-ava-purple text-white' :
              isGuest ? 'text-gray-600 hover:text-gray-400' :
              'text-gray-400 hover:text-white hover:bg-ava-surface'
            }`}
            title={isGuest ? 'Sign in to use Tasks' : 'Tasks'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {isGuest && (
              <svg className="w-3 h-3 absolute -top-0.5 -right-0.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Journal button */}
          <button
            onClick={() => togglePanel('journal')}
            className={`p-2 rounded-lg transition relative ${
              sidePanel === 'journal' ? 'bg-ava-purple text-white' :
              isGuest ? 'text-gray-600 hover:text-gray-400' :
              'text-gray-400 hover:text-white hover:bg-ava-surface'
            }`}
            title={isGuest ? 'Sign in to use Journal' : 'Journal'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {isGuest && (
              <svg className="w-3 h-3 absolute -top-0.5 -right-0.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-ava-surface transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-ava-surface border border-ava-border rounded-xl shadow-xl z-20 min-w-[180px] py-1">
                  {isGuest ? (
                    <>
                      <div className="px-3 py-2 text-xs text-gray-500 border-b border-ava-border">Guest Mode</div>
                      <button
                        onClick={() => { setShowMenu(false); setShowAuthModal(true); }}
                        className="w-full text-left px-3 py-2 text-sm text-ava-purple-light hover:bg-ava-surface-hover transition"
                      >
                        Sign In / Create Account
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-sm text-gray-400 border-b border-ava-border">{session.user.email}</div>
                      <button
                        onClick={() => { setShowMenu(false); onSignOut(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-ava-surface-hover transition"
                      >
                        Sign Out
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Nudge banner */}
      {showNudge && (
        <div className="shrink-0 bg-ava-purple/10 border-b border-ava-purple/20 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-gray-300">
            <span className="text-ava-purple-light font-medium">Enjoying Ava?</span> Create a free account for memory, tasks, journal, and 14 models.
          </p>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-sm font-medium text-white bg-ava-purple px-3 py-1 rounded-lg hover:bg-ava-purple-dark transition"
            >
              Sign Up Free
            </button>
            <button
              onClick={() => setNudgeDismissed(true)}
              className="text-gray-500 hover:text-gray-300 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
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
        </div>

        {/* Side panel */}
        {sidePanel !== 'none' && token && (
          <div className="w-80 border-l border-ava-border shrink-0 flex flex-col bg-ava-bg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ava-border">
              <h2 className="font-semibold text-white">
                {sidePanel === 'tasks' ? 'Tasks' : 'Journal'}
              </h2>
              <button
                onClick={() => setSidePanel('none')}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidePanel === 'tasks' && <TasksPanel token={token} />}
              {sidePanel === 'journal' && <JournalPanel token={token} />}
            </div>
          </div>
        )}
      </div>

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm mx-4">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white transition"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <AuthPage onSignIn={() => { setShowAuthModal(false); onSignIn(); }} />
          </div>
        </div>
      )}
    </div>
  );
}
