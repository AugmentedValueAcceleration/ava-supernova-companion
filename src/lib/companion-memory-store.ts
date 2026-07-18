// Local-first memory store for the companion. The Memory tab reads/writes
// `ava-companion-memories`; this lets Ava's chat memory_save tool-calls land
// there in Local data mode (and be sent back up so she can recall them).

export interface CompanionMemory {
  id: string;
  key: string;
  content: string;
  category: string;
}

const KEY = 'ava-companion-memories';
export const MEMORIES_CHANGED_EVENT = 'ava-companion-memories-changed';

function read(): CompanionMemory[] {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function write(memories: CompanionMemory[]) {
  localStorage.setItem(KEY, JSON.stringify(memories));
  window.dispatchEvent(new Event(MEMORIES_CHANGED_EVENT));
}

/** Sent up each turn so Ava can recall / reference / dedupe against them. */
export function readLocalMemories(): CompanionMemory[] {
  return read();
}

/** Apply an Ava-saved memory from a `memory_local` SSE event. Dedupes by key —
 *  saving an existing key updates it rather than piling up duplicates. */
export function applyMemoryLocal(evt: { memory?: CompanionMemory }) {
  if (!evt.memory || !evt.memory.key) return;
  const memories = read();
  const idx = memories.findIndex(m => m.key === evt.memory!.key);
  if (idx >= 0) {
    memories[idx] = { ...memories[idx], ...evt.memory };
    write(memories);
  } else {
    write([...memories, evt.memory]);
  }
}
