import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface SupportChatProps {
  token: string;
  onBack: () => void;
}

export function SupportChat({ token, onBack }: SupportChatProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => loadMessages(activeConvId), 10000);
    return () => clearInterval(interval);
  }, [activeConvId]);

  async function loadConversations() {
    try {
      const res = await apiFetch('/support/conversations', {}, token);
      const data = await res.json();
      setConversations(data?.conversations || []);
    } catch { setConversations([]); }
    setLoading(false);
  }

  async function loadMessages(convId: string) {
    try {
      const res = await apiFetch(`/support/conversations/${convId}/messages`, {}, token);
      const data = await res.json();
      setMessages(data?.messages || []);
      setActiveConvId(convId);
      // Mark as read
      apiFetch(`/support/conversations/${convId}/read`, { method: 'POST' }, token).catch(() => {});
    } catch { setMessages([]); }
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      if (activeConvId) {
        await apiFetch(`/support/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        }, token);
        setTimeout(() => loadMessages(activeConvId), 1500);
      } else {
        const res = await apiFetch('/support/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, platform: 'companion' }),
        }, token);
        const data = await res.json();
        if (data?.conversation) {
          setActiveConvId(data.conversation.id);
          setTimeout(() => loadMessages(data.conversation.id), 1500);
          loadConversations();
        }
      }
    } catch { /* */ }
    setSending(false);
  }, [input, sending, activeConvId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ava-border border-t-ava-purple" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ava-border shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-sm font-medium text-white">Support</h2>
          <p className="text-[10px] text-gray-500">Chat with Ava and the team</p>
        </div>
        {!activeConvId && conversations.length > 0 && (
          <button
            onClick={() => { setActiveConvId(null); setMessages([]); }}
            className="ml-auto text-[10px] text-ava-purple"
          >
            + New
          </button>
        )}
      </div>

      {activeConvId || messages.length > 0 ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.map((msg: any) => {
              const isUser = msg.sender_type === 'user';
              const time = new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    isUser ? 'bg-ava-purple text-white' : 'bg-ava-surface text-gray-300'
                  }`}>
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-white">{msg.sender_name}</span>
                        {msg.is_ava && (
                          <span className="text-[7px] font-bold uppercase tracking-wider text-ava-purple bg-ava-purple/15 px-1 py-px rounded">Ava</span>
                        )}
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <p className={`text-[9px] mt-1 ${isUser ? 'text-white/50' : 'text-gray-600'}`}>{time}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-ava-border px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-sm text-white outline-none focus:border-ava-purple"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="rounded-lg bg-ava-purple px-4 py-2 text-xs font-medium text-white transition hover:bg-ava-purple/80 disabled:opacity-30"
              >
                Send
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Conversation list or empty state */
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div className="p-4 space-y-2">
              {conversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className="w-full text-left rounded-lg border border-ava-border bg-ava-surface p-3 transition hover:border-ava-purple/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">
                      {new Date(conv.last_message_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    {conv.unread_user > 0 && (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-ava-purple text-[8px] font-bold text-white">
                        {conv.unread_user}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {conv.lastMessage?.preview || conv.summary || 'New conversation'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-sm font-medium text-white mb-1">Need a hand?</h3>
              <p className="text-xs text-gray-500 mb-6">
                Just type below. Ava will try to help — and if she can't, the team will jump in.
              </p>
              <div className="flex gap-2 w-full max-w-xs">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="What's up?"
                  className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-sm text-white outline-none focus:border-ava-purple"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="rounded-lg bg-ava-purple px-4 py-2 text-xs font-medium text-white disabled:opacity-30"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
