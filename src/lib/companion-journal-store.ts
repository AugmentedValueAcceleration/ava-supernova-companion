// Local-first journal store for the companion. The Journal tab reads/writes
// `ava-journal-{date}` = { user_content, user_mood, ava_content }; this module
// lets Ava's chat journal_write tool-calls land there in Local data mode.
//
// author 'user'  → the user's own entry (Your Journal) + optional mood
// author 'ava'   → Ava's own entry for the day (Ava's Journal)
// The other author's content is preserved on write, so Ava logging her
// reflection never wipes what the user wrote, and vice-versa.

export const JOURNAL_CHANGED_EVENT = 'ava-companion-journal-changed';

interface JournalEntry {
  user_content?: string;
  user_mood?: number | null;
  ava_content?: string;
}

/** Apply an Ava-originated journal write from a `journal_local` SSE event. */
export function applyJournalLocal(evt: { date: string; author: string; content: string; mood?: number }) {
  const key = `ava-journal-${evt.date}`;
  let entry: JournalEntry = {};
  try {
    const s = localStorage.getItem(key);
    if (s) entry = JSON.parse(s);
  } catch {
    entry = {};
  }
  if (evt.author === 'user') {
    entry.user_content = evt.content;
    if (evt.mood != null) entry.user_mood = evt.mood;
  } else {
    entry.ava_content = evt.content;
  }
  localStorage.setItem(key, JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT, { detail: { date: evt.date } }));
}
