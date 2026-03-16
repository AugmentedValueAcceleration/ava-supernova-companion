'use client';

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string;
}

function getTodayTasks(): Task[] {
  const today = new Date().toISOString().split('T')[0];
  try {
    const stored = localStorage.getItem('ava-companion-tasks');
    const tasks: Task[] = stored ? JSON.parse(stored) : [];
    return tasks.filter(t => t.due_date === today && t.status !== 'done');
  } catch {
    return [];
  }
}

function showTaskNotifications() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const tasks = getTodayTasks();
  if (tasks.length === 0) return;

  const title = tasks.length === 1
    ? `Task due today: ${tasks[0].title}`
    : `${tasks.length} tasks due today`;

  const body = tasks.length === 1
    ? 'Tap to view in Ava Companion'
    : tasks.slice(0, 3).map(t => t.title).join(', ') + (tasks.length > 3 ? '...' : '');

  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'ava-task-reminder',
    });
  } catch {
    // Notification may fail silently in some contexts
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!('Notification' in window)) return Promise.resolve(null);
  return Notification.requestPermission();
}

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startTaskNotifications() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  // Check immediately
  showTaskNotifications();

  // Check every 30 minutes
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(showTaskNotifications, CHECK_INTERVAL);
}

export function stopTaskNotifications() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
