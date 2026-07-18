'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { tasksApi } from '@/lib/api';
import { includesCloud, includesLocal } from '@/lib/data-mode';
import { CustomSelect } from './CustomSelect';

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  due_date?: string;
  source: string;
}

// Same option sets the extension/IDE QuickAdd uses, so a task added on the
// phone carries the same priority + category vocabulary as one added on
// desktop. Values are shown raw (capitalised) — matching how the companion
// already renders task.priority — so no 40-key i18n mirror is needed.
const CATEGORY_OPTIONS = ['personal', 'coding', 'admin', 'meeting', 'health', 'finance', 'errands', 'study', 'home'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

interface CreateTaskInput { title: string; priority: string; category: string; due_date?: string }

export default function TasksPanel({ token }: { token: string | null }) {
  useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  // Route on BOTH Data Mode and token presence — not token alone. Users
  // who set the mode to 'local' stay local even when signed in; users
  // on 'both' get writes mirrored to cloud AND local so nothing is
  // lost if they go offline. Cloud is still the source of truth for
  // read when the mode permits it.
  const loadTasks = useCallback(async () => {
    const useCloud = includesCloud() && !!token;

    const readLocal = () => {
      try {
        const stored = localStorage.getItem('ava-companion-tasks');
        setTasks(stored ? JSON.parse(stored) : []);
      } catch { setTasks([]); }
    };

    if (!useCloud) {
      readLocal();
      setLoading(false);
      return;
    }
    try {
      const data = await tasksApi.list(token!);
      setTasks(data.tasks || data || []);
    } catch {
      readLocal();
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveLocal = (updated: Task[]) => {
    localStorage.setItem('ava-companion-tasks', JSON.stringify(updated));
  };

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const createTask = async (input: CreateTaskInput) => {
    const title = input.title.trim();
    if (!title) return;
    const useCloud = includesCloud() && !!token;
    const useLocal = includesLocal() || !token;

    // Mirror into local state + storage first for instant UI. Cloud fires
    // in parallel only if the mode permits (it never does today — local-first).
    const task: Task = {
      id: Date.now().toString(),
      title,
      priority: input.priority,
      status: 'todo',
      category: input.category,
      due_date: input.due_date,
      source: 'user',
    };
    if (useLocal) {
      const updated = [...tasks, task];
      setTasks(updated);
      saveLocal(updated);
    }
    if (useCloud) {
      try {
        await tasksApi.create(token!, {
          title,
          due_date: input.due_date,
          priority: input.priority,
          category: input.category,
        });
        loadTasks();
      } catch { /* non-fatal — local copy kept if cloud fails */ }
    }
  };

  const deleteTask = async (task: Task) => {
    const useCloud = includesCloud() && !!token;
    const useLocal = includesLocal() || !token;

    if (useLocal) {
      const updated = tasks.filter(t => t.id !== task.id);
      setTasks(updated);
      saveLocal(updated);
    }
    if (useCloud) {
      try {
        await tasksApi.delete(token!, task.id);
        loadTasks();
      } catch { /* non-fatal */ }
    }
  };

  const toggleTask = async (task: Task) => {
    const useCloud = includesCloud() && !!token;
    const useLocal = includesLocal() || !token;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';

    if (useLocal) {
      const updated = tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t);
      setTasks(updated);
      saveLocal(updated);
    }
    if (useCloud) {
      try {
        await tasksApi.update(token!, task.id, {
          status: nextStatus,
          completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
        });
        loadTasks();
      } catch { /* non-fatal */ }
    }
  };

  const filtered = filter === 'today'
    ? tasks.filter(t => t.due_date === today || t.status === 'in_progress')
    : tasks;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('today')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition border ${filter === 'today' ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-transparent bg-ava-surface text-gray-400 hover:text-white'}`}
        >
          {t('today')}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition border ${filter === 'all' ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple' : 'border-transparent bg-ava-surface text-gray-400 hover:text-white'}`}
        >
          {t('all')}
        </button>
      </div>

      {/* Add task — same collapsible QuickAdd shape as the extension/IDE:
          title + priority + category + due date. "Today" view defaults the
          due date to today so the new task lands where it was added. */}
      <QuickAdd onCreate={createTask} defaultDueToday={filter === 'today'} />

      {/* Task list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>{filter === 'today' ? t('nothingToday') : t('noActiveTasks')}</p>
          <p className="text-xs mt-1">{t('addTaskHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
            return (
              <div key={task.id} className="flex items-start gap-2 bg-ava-surface border border-ava-border rounded-lg p-3">
                <button onClick={() => toggleTask(task)} className="mt-0.5 shrink-0">
                  {task.status === 'done' ? (
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-500 rounded" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
                    {task.title}
                    {task.source === 'ava' && (
                      <span className="ml-2 text-[10px] font-bold text-ava-purple-light bg-ava-purple/15 px-1.5 py-0.5 rounded">Ava</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority] || 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-500 capitalize">{task.priority}</span>
                    {task.category && <span className="text-xs text-gray-600 capitalize">· {task.category}</span>}
                    {task.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                        {task.due_date === today ? t('today') : task.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task)}
                  className="shrink-0 p-1.5 text-gray-600 hover:text-red-400 transition"
                  title={t('deleteTask')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Collapsible add form — mirrors the extension/IDE QuickAdd: a dashed
// "add" affordance that expands into title + priority + category + due date,
// styled in the house accent-tint. Enter adds and keeps the form open for
// rapid entry; Escape closes it.
function QuickAdd({ onCreate, defaultDueToday }: { onCreate: (t: CreateTaskInput) => void; defaultDueToday: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('personal');
  const [dueDate, setDueDate] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const reset = () => { setTitle(''); setPriority('medium'); setCategory('personal'); setDueDate(''); };
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const due = dueDate || (defaultDueToday ? new Date().toISOString().slice(0, 10) : undefined);
    onCreate({ title: trimmed, priority, category, due_date: due });
    reset();
    inputRef.current?.focus();
  };
  const cancel = () => { reset(); setOpen(false); };

  const fieldCls = 'flex-1 min-w-0 bg-ava-surface border border-ava-border rounded-md px-2 py-1.5 text-xs text-white focus:border-ava-purple focus:outline-none';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-ava-purple/25 text-gray-400 hover:text-white transition"
      >
        <span className="text-ava-purple text-base leading-none">+</span>
        {t('addTask')}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-ava-purple/15 bg-ava-purple/5 p-2 flex flex-col gap-2">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') cancel(); }}
        placeholder={t('addTaskPlaceholder')}
        className="w-full bg-ava-surface border border-ava-border rounded-md px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
      />
      <CustomSelect
        value={priority}
        onChange={setPriority}
        options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
      />
      <div className="flex items-center gap-1.5">
        <input list="quickadd-categories" value={category} onChange={e => setCategory(e.target.value)} title="Category" placeholder="Category" className={`${fieldCls} capitalize`} />
        <datalist id="quickadd-categories">{CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}</datalist>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} title="Due date" className={`${fieldCls} text-gray-300 cursor-pointer`} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="border border-ava-purple/25 bg-ava-purple/10 text-ava-purple text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-ava-purple/20 disabled:opacity-30 transition"
        >
          {t('addTask')}
        </button>
        <button onClick={cancel} className="text-gray-400 hover:text-white text-sm px-3 py-1.5 transition">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
