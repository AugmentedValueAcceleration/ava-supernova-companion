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

/** Recent entries (newest first) sent up each turn so Ava can *read* the
 *  journal — how the user's been feeling, what they reflected on — and learn
 *  from it to assist better. Content is included, not just dates. */
export function readRecentJournal(days = 14): Array<{ date: string; user_content?: string; ava_content?: string; user_mood?: number | null }> {
  const out: Array<{ date: string; user_content?: string; ava_content?: string; user_mood?: number | null }> = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    try {
      const s = localStorage.getItem(`ava-journal-${date}`);
      if (!s) continue;
      const e = JSON.parse(s) as JournalEntry;
      if (e.user_content || e.ava_content) {
        out.push({ date, user_content: e.user_content, ava_content: e.ava_content, user_mood: e.user_mood });
      }
    } catch {
      /* skip a corrupt entry */
    }
  }
  return out;
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
