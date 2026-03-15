'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface Memory {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  personal: 'bg-blue-500',
  work: 'bg-amber-500',
  preference: 'bg-purple-500',
  project: 'bg-emerald-500',
  fact: 'bg-cyan-500',
};

export default function MemoryPanel({ token }: { token: string | null }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!token) {
      setMemories([]);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch('/memories', {}, token);
      const data = await res.json();
      setMemories(data.memories || data || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const deleteMemory = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/memories/${id}`, { method: 'DELETE' }, token);
      loadMemories();
    } catch { /* ignore */ }
  };

  const filtered = search.trim()
    ? memories.filter(m =>
        m.key.toLowerCase().includes(search.toLowerCase()) ||
        m.value.toLowerCase().includes(search.toLowerCase())
      )
    : memories;

  if (!token) {
    return (
      <div className="p-4 text-center py-12">
        <div className="w-14 h-14 mx-auto rounded-full bg-ava-purple/10 border border-ava-purple/30 flex items-center justify-center mb-3">
          <svg className="w-7 h-7 text-ava-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">Sign in to access Ava&apos;s memory</p>
        <p className="text-xs text-gray-600 mt-1">Ava remembers your preferences, context, and important details across all sessions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search memories..."
          aria-label="Search memories"
          className="w-full bg-ava-surface border border-ava-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
        />
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            {search ? 'No memories match your search' : 'No memories yet'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {search ? 'Try a different search term' : 'Ava will remember things as you chat'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(memory => (
            <div key={memory.id} className="bg-ava-surface border border-ava-border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${categoryColors[memory.category] || 'bg-gray-500'}`} />
                    <span className="text-xs font-medium text-ava-purple-light">{memory.key}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{memory.value}</p>
                  <p className="text-[11px] text-gray-600 mt-1.5">
                    {new Date(memory.updated_at || memory.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
                {confirmDelete === memory.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { deleteMemory(memory.id); setConfirmDelete(null); }}
                      className="text-[10px] text-red-400 font-medium px-2 py-1 bg-red-400/10 rounded hover:bg-red-400/20 transition"
                      aria-label="Confirm delete memory"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-[10px] text-gray-400 font-medium px-2 py-1 bg-ava-border rounded hover:bg-gray-600 transition"
                      aria-label="Cancel delete"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(memory.id)}
                    className="shrink-0 text-gray-600 hover:text-red-400 transition p-1"
                    aria-label={`Delete memory: ${memory.key}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
