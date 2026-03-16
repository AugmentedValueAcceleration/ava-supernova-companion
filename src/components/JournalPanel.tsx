'use client';

import { useState, useEffect, useCallback } from 'react';
import { journalApi } from '@/lib/api';

const moodEmojis = ['😔', '😕', '😐', '🙂', '😊'];

export default function JournalPanel({ token }: { token: string | null }) {
  const [tab, setTab] = useState<'yours' | 'ava'>('yours');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userContent, setUserContent] = useState('');
  const [avaContent, setAvaContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  const loadEntry = useCallback(async () => {
    setLoading(true);
    if (!token) {
      try {
        const stored = localStorage.getItem(`ava-journal-${selectedDate}`);
        if (stored) {
          const entry = JSON.parse(stored);
          setUserContent(entry.user_content || '');
          setAvaContent(entry.ava_content || '');
          setMood(entry.user_mood ?? null);
        } else {
          setUserContent(''); setAvaContent(''); setMood(null);
        }
      } catch { setUserContent(''); setAvaContent(''); setMood(null); }
      setLoading(false);
      return;
    }
    try {
      const data = await journalApi.get(token, selectedDate);
      if (data.entry) {
        setUserContent(data.entry.user_content || '');
        setAvaContent(data.entry.ava_content || '');
        setMood(data.entry.user_mood);
      } else {
        setUserContent('');
        setAvaContent('');
        setMood(null);
      }
    } catch {
      setUserContent('');
      setAvaContent('');
      setMood(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

  const saveEntry = async () => {
    if (!token) {
      localStorage.setItem(`ava-journal-${selectedDate}`, JSON.stringify({
        user_content: userContent, user_mood: mood, ava_content: avaContent,
      }));
      setEditing(false);
      return;
    }
    try {
      await journalApi.upsert(token, {
        date: selectedDate,
        user_content: userContent,
        user_mood: mood ?? undefined,
      });
      setEditing(false);
    } catch { /* api error */ }
  };

  const deleteEntry = async () => {
    if (!token) {
      localStorage.removeItem(`ava-journal-${selectedDate}`);
      setUserContent(''); setAvaContent(''); setMood(null);
      return;
    }
    try {
      await journalApi.delete(token, selectedDate);
      setUserContent(''); setAvaContent(''); setMood(null);
    } catch { /* api error */ }
  };

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const newDate = d.toISOString().split('T')[0];
    if (newDate <= today) {
      setSelectedDate(newDate);
      setEditing(false);
    }
  };

  const dateLabel = isToday ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div className="p-4 space-y-3">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="text-gray-400 hover:text-white transition p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <button onClick={() => setSelectedDate(today)} className={`text-sm font-semibold ${isToday ? 'text-ava-purple' : 'text-white'}`}>
            {dateLabel}
          </button>
          <p className="text-[11px] text-gray-500">{selectedDate}</p>
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={selectedDate >= today}
          className="text-gray-400 hover:text-white transition p-1 disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('yours')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'yours' ? 'bg-ava-purple text-white' : 'bg-ava-surface text-gray-400'}`}
        >
          Your Journal
        </button>
        <button
          onClick={() => setTab('ava')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'ava' ? 'bg-ava-purple text-white' : 'bg-ava-surface text-gray-400'}`}
        >
          Ava&apos;s Journal
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : tab === 'yours' ? (
        <div>
          {/* Mood */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500">Mood:</span>
            {moodEmojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg transition ${
                  mood === i + 1 ? 'border-ava-purple bg-ava-purple/20' : 'border-ava-border'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {editing ? (
            <div>
              <textarea
                value={userContent}
                onChange={e => setUserContent(e.target.value)}
                placeholder="How are you feeling? What happened today?"
                autoFocus
                className="w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none resize-none min-h-[200px]"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveEntry} className="bg-ava-purple text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-ava-purple-dark transition">
                  Save
                </button>
                <button onClick={() => { setEditing(false); loadEntry(); }} className="bg-ava-surface text-gray-400 text-sm px-4 py-1.5 rounded-lg border border-ava-border hover:text-white transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : userContent ? (
            <div>
              <button onClick={() => setEditing(true)} className="text-left w-full">
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{userContent}</p>
                <p className="text-[11px] text-gray-600 mt-2">Tap to edit</p>
              </button>
              <button
                onClick={deleteEntry}
                className="mt-2 text-xs text-red-400/60 hover:text-red-400 transition"
              >
                Delete entry
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No entry for this day</p>
              <button onClick={() => setEditing(true)} className="mt-2 bg-ava-purple text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-ava-purple-dark transition">
                Write Entry
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {avaContent ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-white">Ava</span>
                <span className="text-[9px] font-bold text-ava-purple-light bg-ava-purple-dark/40 px-1.5 py-0.5 rounded tracking-wider">SUPERNOVA</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{avaContent}</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">Ava hasn&apos;t written anything for this day</p>
              <p className="text-gray-600 text-xs mt-1">Ava writes her thoughts at the end of sessions</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
