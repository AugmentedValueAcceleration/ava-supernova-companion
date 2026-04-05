export interface Personality {
  name: string;
  pronouns: string;
  tone: string;
  energy: string;
  style: string;
  description: string;
}

// Ava's identity is fixed — name and pronouns are not user-configurable
export const AVA_NAME = 'Ava';
export const AVA_PRONOUNS = 'she/her';

export const DEFAULT_PERSONALITY: Personality = {
  name: AVA_NAME,
  pronouns: AVA_PRONOUNS,
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
  // Ava's identity is locked — always enforce name and pronouns
  const locked: Personality = { ...p, name: AVA_NAME, pronouns: AVA_PRONOUNS };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locked));
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
  parts.push(`Your name is ${AVA_NAME}. Use ${AVA_PRONOUNS} pronouns.`);
  parts.push(`Tone: ${p.tone}. Energy: ${p.energy}. Communication style: ${p.style}.`);
  if (p.description) {
    parts.push(`Additional personality notes: ${p.description}`);
  }
  return parts.join(' ');
}
