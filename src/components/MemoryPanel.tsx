'use client';

import { useState, useEffect, useCallback } from 'react';
import { memoriesApi } from '@/lib/api';

interface Memory {
  id: string;
  key: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  synced?: boolean; // false = local-only, true/undefined = synced to cloud
}

const STORAGE_KEY = 'ava-companion-memories';

const categoryColors: Record<string, string> = {
  personal: 'bg-blue-500',
  work: 'bg-amber-500',
  preference: 'bg-purple-500',
  project: 'bg-emerald-500',
  general: 'bg-gray-500',
  pattern: 'bg-cyan-500',
  architecture: 'bg-indigo-500',
  'bug-fix': 'bg-red-500',
  convention: 'bg-teal-500',
  'tool-config': 'bg-orange-500',
  decision: 'bg-pink-500',
  person: 'bg-yellow-500',
};

const categories = ['general', 'preference', 'personal', 'work', 'project', 'pattern', 'architecture', 'decision'] as const;

// ── Local storage helpers ────────────────────────────────────────────

function loadLocal(): Memory[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveLocal(memories: Memory[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

// ── Component ────────────────────────────────────────────────────────

export default function MemoryPanel({ token }: { token: string | null }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('general');

  // ── Load memories ──────────────────────────────────────────────────

  const loadMemories = useCallback(async () => {
    setLoading(true);
    if (!token) {
      setMemories(loadLocal());
      setLoading(false);
      return;
    }
    try {
      const data = await memoriesApi.list(token);
      const remote: Memory[] = (data.memories || data || []).map((m: Memory) => ({ ...m, synced: true }));
      // Merge with any unsynced local memories
      const local = loadLocal().filter(m => !m.synced);
      setMemories([...local, ...remote]);
    } catch {
      // Fall back to local
      setMemories(loadLocal());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  // ── CRUD operations ────────────────────────────────────────────────

  const addMemory = async () => {
    if (!formKey.trim() || !formContent.trim()) return;

    const memory: Memory = {
      id: crypto.randomUUID(),
      key: formKey.trim(),
      content: formContent.trim(),
      category: formCategory,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    if (!token) {
      const updated = [memory, ...memories];
      setMemories(updated);
      saveLocal(updated);
    } else {
      try {
        await memoriesApi.create(token, { key: memory.key, content: memory.content, category: memory.category });
        loadMemories();
      } catch {
        // Save locally as fallback
        const updated = [memory, ...memories];
        setMemories(updated);
        saveLocal(updated);
      }
    }
    resetForm();
  };

  const updateMemory = async () => {
    if (!editingId || !formKey.trim() || !formContent.trim()) return;

    if (!token) {
      const updated = memories.map(m => m.id === editingId
        ? { ...m, key: formKey.trim(), content: formContent.trim(), category: formCategory, updated_at: new Date().toISOString() }
        : m
      );
      setMemories(updated);
      saveLocal(updated);
    } else {
      const mem = memories.find(m => m.id === editingId);
      if (mem?.synced) {
        try {
          await memoriesApi.update(token, editingId, { key: formKey.trim(), content: formContent.trim(), category: formCategory });
          loadMemories();
        } catch { /* ignore */ }
      } else {
        // Local-only memory — update in localStorage
        const updated = memories.map(m => m.id === editingId
          ? { ...m, key: formKey.trim(), content: formContent.trim(), category: formCategory, updated_at: new Date().toISOString() }
          : m
        );
        setMemories(updated);
        saveLocal(updated);
      }
    }
    resetForm();
  };

  const deleteMemory = async (id: string) => {
    const mem = memories.find(m => m.id === id);
    if (token && mem?.synced) {
      try {
        await memoriesApi.delete(token, id);
      } catch { /* ignore */ }
    }
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    saveLocal(updated.filter(m => !m.synced));
    setConfirmDelete(null);
  };

  // ── Sync local → cloud ────────────────────────────────────────────

  const syncToCloud = async () => {
    if (!token) return;
    setSyncing(true);
    const unsynced = memories.filter(m => !m.synced);
    for (const mem of unsynced) {
      try {
        await memoriesApi.create(token, { key: mem.key, content: mem.content, category: mem.category });
      } catch { /* skip failed ones */ }
    }
    // Clear local unsynced
    saveLocal([]);
    await loadMemories();
    setSyncing(false);
  };

  // ── Form helpers ───────────────────────────────────────────────────

  const resetForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setFormKey('');
    setFormContent('');
    setFormCategory('general');
  };

  const startEdit = (mem: Memory) => {
    setEditingId(mem.id);
    setFormKey(mem.key);
    setFormContent(mem.content);
    setFormCategory(mem.category);
    setShowAdd(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setFormKey('');
    setFormContent('');
    setFormCategory('general');
    setShowAdd(true);
  };

  // ── Filter ─────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? memories.filter(m =>
        m.key.toLowerCase().includes(search.toLowerCase()) ||
        m.content.toLowerCase().includes(search.toLowerCase())
      )
    : memories;

  const unsyncedCount = memories.filter(m => !m.synced).length;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-3">
      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
        <button
          onClick={startAdd}
          aria-label="Add memory"
          className="bg-ava-purple text-white px-3 rounded-lg text-sm font-medium hover:bg-ava-purple-dark transition"
        >
          +
        </button>
      </div>

      {/* Sync banner — show when signed in with unsynced local memories */}
      {token && unsyncedCount > 0 && (
        <div className="flex items-center justify-between bg-ava-purple/10 border border-ava-purple/20 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-300">
            <span className="text-ava-purple-light font-medium">{unsyncedCount}</span> local {unsyncedCount === 1 ? 'memory' : 'memories'} not synced
          </span>
          <button
            onClick={syncToCloud}
            disabled={syncing}
            className="text-xs font-medium text-white bg-ava-purple px-3 py-1 rounded-lg hover:bg-ava-purple-dark transition disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Push to Cloud'}
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {(showAdd || editingId) && (
        <div className="bg-ava-surface border border-ava-purple/50 rounded-lg p-3 space-y-2.5">
          <input
            value={formKey}
            onChange={e => setFormKey(e.target.value)}
            placeholder="Memory title (e.g. 'Prefers dark mode')"
            autoFocus
            aria-label="Memory title"
            className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
          />
          <textarea
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="Details..."
            aria-label="Memory content"
            className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none resize-none min-h-[80px]"
          />
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Category</label>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              aria-label="Memory category"
              className="w-full bg-ava-bg border border-ava-border rounded-lg px-2 py-1.5 text-xs text-white focus:border-ava-purple focus:outline-none appearance-none"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={editingId ? updateMemory : addMemory}
              disabled={!formKey.trim() || !formContent.trim()}
              className="flex-1 bg-ava-purple text-white text-xs font-medium py-1.5 rounded-lg hover:bg-ava-purple-dark transition disabled:opacity-30"
            >
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-ava-bg text-gray-400 text-xs py-1.5 rounded-lg border border-ava-border hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Not signed in hint */}
      {!token && memories.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <div className="w-14 h-14 mx-auto rounded-full bg-ava-purple/10 border border-ava-purple/30 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-ava-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
          </div>
          <p className="text-sm text-gray-400">Memories are saved locally</p>
          <p className="text-xs text-gray-600 mt-1">Sign in to sync across devices. Tap + to add your first memory.</p>
        </div>
      )}

      {/* Memory list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : filtered.length === 0 && (memories.length > 0 || token) ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            {search ? 'No memories match your search' : 'No memories yet'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {search ? 'Try a different search term' : 'Tap + to add one, or Ava will remember things as you chat'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(memory => (
            <div key={memory.id} className="bg-ava-surface border border-ava-border rounded-lg p-3 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${categoryColors[memory.category] || 'bg-gray-500'}`} />
                    <span className="text-xs font-medium text-ava-purple-light">{memory.key}</span>
                    {!memory.synced && (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded">LOCAL</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{memory.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-gray-600">
                      {new Date(memory.updated_at || memory.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    <span className="text-[11px] text-gray-700">{memory.category}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  {confirmDelete === memory.id ? (
                    <>
                      <button onClick={() => deleteMemory(memory.id)} className="text-[10px] text-red-400 px-2 py-1 bg-red-400/10 rounded" aria-label="Confirm delete">Yes</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-gray-400 px-2 py-1 bg-ava-border rounded" aria-label="Cancel delete">No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(memory)} className="text-gray-600 hover:text-white transition p-1" aria-label={`Edit memory: ${memory.key}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                        </svg>
                      </button>
                      <button onClick={() => setConfirmDelete(memory.id)} className="text-gray-600 hover:text-red-400 transition p-1" aria-label={`Delete memory: ${memory.key}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
