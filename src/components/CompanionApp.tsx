'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sendChat } from '@/lib/api';
import TasksPanel from './TasksPanel';
import JournalPanel from './JournalPanel';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type SidePanel = 'none' | 'tasks' | 'journal';

export default function CompanionApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const userName = session.user.user_metadata?.full_name?.split(' ')[0] || 'there';
  const token = session.access_token;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hey ${userName}! I'm Ava — your companion on the go. I can manage your tasks, write journal entries, and chat about anything.\n\nWhat's on your mind?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>('none');
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const history = messages
      .filter(m => m.id !== '1')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      await sendChat(token, userMsg.content, history, 'glm-4-flash', (text) => {
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
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? 'none' : panel);
  };

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
          {/* Tasks button */}
          <button
            onClick={() => togglePanel('tasks')}
            className={`p-2 rounded-lg transition ${sidePanel === 'tasks' ? 'bg-ava-purple text-white' : 'text-gray-400 hover:text-white hover:bg-ava-surface'}`}
            title="Tasks"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>

          {/* Journal button */}
          <button
            onClick={() => togglePanel('journal')}
            className={`p-2 rounded-lg transition ${sidePanel === 'journal' ? 'bg-ava-purple text-white' : 'text-gray-400 hover:text-white hover:bg-ava-surface'}`}
            title="Journal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
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
                <div className="absolute right-0 top-full mt-1 bg-ava-surface border border-ava-border rounded-xl shadow-xl z-20 min-w-[160px] py-1">
                  <div className="px-3 py-2 text-sm text-gray-400 border-b border-ava-border">{session.user.email}</div>
                  <button
                    onClick={() => { setShowMenu(false); onSignOut(); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-ava-surface-hover transition"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

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
        {sidePanel !== 'none' && (
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
    </div>
  );
}
