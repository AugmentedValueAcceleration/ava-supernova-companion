// Local-first task store for the companion. The Tasks tab reads/writes the
// same `ava-companion-tasks` key; this module lets Ava's chat tool-calls apply
// task changes to that store and notifies any mounted view to refresh.
//
// Why this exists: the companion is Local data mode, so Ava's server-side
// task_manage tool can't touch the device. Instead the chat route emits a
// `task_local` SSE event and the client applies it here — the same round-trip
// health plans already use via savePlan().

export interface CompanionTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  due_date?: string;
  source: string;
}

const KEY = 'ava-companion-tasks';
export const TASKS_CHANGED_EVENT = 'ava-companion-tasks-changed';

function read(): CompanionTask[] {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function write(tasks: CompanionTask[]) {
  localStorage.setItem(KEY, JSON.stringify(tasks));
  // Let a mounted Tasks view re-read immediately (chat and tasks are separate
  // views, but this also covers the case where both are on screen on desktop).
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
}

/** Compact list Ava is shown so she can reference / complete / dedupe against
 *  the user's real (local) tasks — sent up with each chat turn. */
export function readLocalTasks(): CompanionTask[] {
  return read();
}

/** Apply an Ava-originated task change from a `task_local` SSE event. */
export function applyTaskLocal(evt: {
  action: string;
  task?: CompanionTask;
  taskId?: string;
  updates?: Partial<CompanionTask>;
}) {
  const tasks = read();
  switch (evt.action) {
    case 'create':
      if (evt.task) write([...tasks, evt.task]);
      break;
    case 'complete':
      write(tasks.map(t => (t.id === evt.taskId ? { ...t, status: 'done' } : t)));
      break;
    case 'update':
      if (evt.updates) write(tasks.map(t => (t.id === evt.taskId ? { ...t, ...evt.updates } : t)));
      break;
    case 'delete':
      write(tasks.filter(t => t.id !== evt.taskId));
      break;
  }
}
