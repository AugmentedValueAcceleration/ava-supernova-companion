// Mobile companion's Data Mode helper. The companion is fully local now —
// every install keeps all data on-device, matching the extension + IDE.
// Cloud sync was removed (cloud storage of user data sunsets 1 Jul 2026),
// so the local/cloud toggle is gone and these helpers are hard-off to
// local. The setters and exports are kept so existing call sites keep
// compiling; they're effectively no-ops now.

export type DataMode = 'local' | 'cloud';

const KEY = 'ava-data-mode';

// Always local. The toggle is gone; nothing writes to the cloud anymore.
export function getDataMode(): DataMode {
  return 'local';
}

export function setDataMode(_mode: DataMode): void {
  // No-op — the companion is local-only. Kept so legacy callers compile.
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, 'local');
}

export function includesLocal(): boolean {
  return true;
}

// Cloud sync is off everywhere. Was: getDataMode() === 'cloud'.
export function includesCloud(): boolean {
  return false;
}

// Health data (plans, profile, logs) is fully local too. Was a separate
// opt-in toggle; now hard-off to match the rest of the app.
export function healthSyncEnabled(): boolean {
  return false;
}
export function setHealthSync(_on: boolean): void {
  // No-op — health data stays on-device.
}
