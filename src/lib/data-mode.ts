// Mobile companion's Data Mode helper. Mirrors the extension / IDE
// helper but defaults to 'cloud' — companion users signed up for a
// sync-first experience, so privacy-first "Local" is opt-in.
//
// The value is read by sendChat() on every request (sent as the
// X-Ava-Data-Mode header so the server's tool-level writes skip cloud
// persistence when Local) and by any client-side sync action that
// wants to know the user's preference before firing.

export type DataMode = 'local' | 'cloud' | 'both';

const KEY = 'ava-data-mode';

export function getDataMode(): DataMode {
  if (typeof localStorage === 'undefined') return 'cloud';
  const raw = localStorage.getItem(KEY);
  if (raw === 'local' || raw === 'cloud' || raw === 'both') return raw;
  return 'cloud';
}

export function setDataMode(mode: DataMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, mode);
  // Let other components react without waiting for a next mount.
  window.dispatchEvent(new CustomEvent('ava-data-mode-changed', { detail: mode }));
}

export function includesLocal(): boolean {
  const m = getDataMode();
  return m === 'local' || m === 'both';
}

export function includesCloud(): boolean {
  const m = getDataMode();
  return m === 'cloud' || m === 'both';
}
