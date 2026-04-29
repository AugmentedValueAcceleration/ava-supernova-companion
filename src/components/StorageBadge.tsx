import { useEffect, useState } from 'react';
import { getDataMode, type DataMode } from '../lib/data-mode';

// The badge that sits in the corner of Tasks / Journal / Memory panels
// telling the user where the data on this screen is being stored.
//
// Three states track the Data Mode toggle in Settings (Privacy section):
//   - "Local"  — on-device only, nothing leaves the phone
//   - "Cloud"  — synced to the platform, mirrored across surfaces
//   - "Both"   — local backup + cloud sync
//
// The badge USED to read off `token` alone, which meant a signed-in
// user who had explicitly chosen Local mode in Settings still saw a
// "Cloud" badge — misleading. Now it reads `getDataMode()` and updates
// live on the `ava-data-mode-changed` event the toggle dispatches.
//
// Falls back to "Local" when there's no auth token regardless of the
// stored mode — without auth the cloud path can't run anyway, so the
// honest answer is always Local.
export function StorageBadge({ token }: { token: string | null }) {
  const [mode, setMode] = useState<DataMode>(() => getDataMode());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DataMode>).detail;
      if (detail === 'local' || detail === 'cloud' || detail === 'both') setMode(detail);
    };
    window.addEventListener('ava-data-mode-changed', handler);
    return () => window.removeEventListener('ava-data-mode-changed', handler);
  }, []);

  const effective: DataMode = !token ? 'local' : mode;

  const styles = effective === 'cloud'
    ? { wrap: 'border-blue-500/20 bg-blue-500/10 text-blue-400', dot: 'bg-blue-400', label: 'Cloud' }
    : effective === 'both'
      ? { wrap: 'border-purple-500/20 bg-purple-500/10 text-purple-400', dot: 'bg-purple-400', label: 'Both' }
      : { wrap: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400', label: 'Local' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${styles.wrap}`}
      title={
        effective === 'local'
          ? 'Local — data stays on this device. Change in Settings → Privacy.'
          : effective === 'cloud'
            ? 'Cloud — data syncs to the platform. Change in Settings → Privacy.'
            : 'Both — local backup + cloud sync. Change in Settings → Privacy.'
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  );
}
