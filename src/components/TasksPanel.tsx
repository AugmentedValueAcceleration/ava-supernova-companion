'use client';

import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '@/lib/api';
import { includesCloud, includesLocal } from '@/lib/data-mode';
import { StorageBadge } from './StorageBadge';

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  due_date?: string;
  source: string;
}

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-blue-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
};

export default function TasksPanel({ token }: { token: string | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [newTask, setNewTask] = useState('');
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

  const addTask = async () => {
    if (!newTask.trim()) return;
    const useCloud = includesCloud() && !!token;
    const useLocal = includesLocal() || !token;

    // Always mirror into local state + storage first for instant UI
    // response. Cloud fires in parallel if the mode permits.
    const task: Task = {
      id: Date.now().toString(),
      title: newTask.trim(),
      priority: 'medium',
      status: 'todo',
      category: 'personal',
      due_date: today,
      source: 'user',
    };
    if (useLocal) {
      const updated = [...tasks, task];
      setTasks(updated);
      saveLocal(updated);
    }
    setNewTask('');

    if (useCloud) {
      try {
        await tasksApi.create(token!, {
          title: task.title,
          due_date: today,
          priority: 'medium',
          category: 'personal',
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
    ? tasks.filter(t => t.due_date === today || t.status === 'in-progress')
    : tasks;

  return (
    <div className="p-4 space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <StorageBadge token={token} />
        <div className="flex-1" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('today')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === 'today' ? 'bg-ava-purple text-white' : 'bg-ava-surface text-gray-400'}`}
        >
          Today
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === 'all' ? 'bg-ava-purple text-white' : 'bg-ava-surface text-gray-400'}`}
        >
          All
        </button>
      </div>

      {/* Add task */}
      <div className="flex gap-2">
        <input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task..."
          className="flex-1 bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none"
        />
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="bg-ava-purple text-white px-3 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-ava-purple-dark transition"
        >
          +
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>{filter === 'today' ? 'Nothing for today' : 'No active tasks'}</p>
          <p className="text-xs mt-1">Add a task above or ask Ava</p>
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
                      <span className="ml-2 text-[10px] font-bold text-ava-purple-light bg-ava-purple-dark/40 px-1.5 py-0.5 rounded">Ava</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority] || 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-500">{task.priority}</span>
                    {task.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                        {task.due_date === today ? 'Today' : task.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task)}
                  className="shrink-0 p-1.5 text-gray-600 hover:text-red-400 transition"
                  title="Delete task"
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
