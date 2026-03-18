export interface Personality {
  name: string;
  pronouns: string;
  tone: string;
  energy: string;
  style: string;
  description: string;
}

export const DEFAULT_PERSONALITY: Personality = {
  name: 'Ava',
  pronouns: 'she/her',
  tone: 'warm',
  energy: 'enthusiastic',
  style: 'conversational',
  description: '',
};

const STORAGE_KEY = 'ava-personality';

export function loadPersonality(): Personality {
  if (typeof window === 'undefined') return DEFAULT_PERSONALITY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PERSONALITY;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PERSONALITY, ...parsed };
  } catch {
    return DEFAULT_PERSONALITY;
  }
}

export function savePersonality(p: Personality): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event('ava-personality-changed'));
}

export function resetPersonality(): Personality {
  savePersonality(DEFAULT_PERSONALITY);
  return DEFAULT_PERSONALITY;
}

/**
 * Build a personality prefix string for the system prompt.
 */
export function buildPersonalityPrefix(p: Personality): string {
  const parts: string[] = [];
  parts.push(`Your name is ${p.name}.`);
  parts.push(`Use ${p.pronouns} pronouns.`);
  parts.push(`Tone: ${p.tone}. Energy: ${p.energy}. Communication style: ${p.style}.`);
  if (p.description) {
    parts.push(`Additional personality: ${p.description}`);
  }
  return parts.join(' ');
}
