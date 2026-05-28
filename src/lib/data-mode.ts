// Mobile companion's Data Mode helper. Local-first by default: every
// companion install starts on-device, and Cloud is an opt-in extra
// layer that mirrors the same writes upstream so the data shows up on
// every Ava surface. There is no longer a separate "Both" — Cloud
// already implies local-first underneath. Legacy 'both' values are
// migrated to 'cloud' on read.

export type DataMode = 'local' | 'cloud';

const KEY = 'ava-data-mode';

export function getDataMode(): DataMode {
  if (typeof localStorage === 'undefined') return 'local';
  const raw = localStorage.getItem(KEY);
  if (raw === 'local') return 'local';
  if (raw === 'cloud') return 'cloud';
  if (raw === 'both') {
    // Legacy value — migrate forward. Old 'both' wrote local+cloud,
    // new 'cloud' does the same thing, so this is a no-op semantically.
    localStorage.setItem(KEY, 'cloud');
    return 'cloud';
  }
  return 'local';
}

export function setDataMode(mode: DataMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent('ava-data-mode-changed', { detail: mode }));
}

// Local is always part of the write path under the new semantics — even
// Cloud mode writes a local mirror first so the UI stays instant and the
// app survives offline.
export function includesLocal(): boolean {
  return true;
}

export function includesCloud(): boolean {
  return getDataMode() === 'cloud';
}

// Health data (plans, profile, logs) is LOCAL BY DEFAULT — it only syncs to
// the cloud when the user explicitly opts in, independent of the global chat
// data mode above. The opt-in toggle + tier storage-capacity gating land in
// the whole-app settings pass; until then this returns false (fully local).
const HEALTH_SYNC_KEY = 'ava-health-sync';
export function healthSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(HEALTH_SYNC_KEY) === 'on';
}
export function setHealthSync(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  if (on) localStorage.setItem(HEALTH_SYNC_KEY, 'on');
  else localStorage.removeItem(HEALTH_SYNC_KEY);
  window.dispatchEvent(new CustomEvent('ava-health-sync-changed', { detail: on }));
}
