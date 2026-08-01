// Shared hook for admin-tier gating. Used by Phase E desktop automation
// surfaces during the admin-only testing window.
//
// Reads tier from /api/usage/summary (same endpoint SettingsView uses).
// Fails closed — any error, missing key, or non-admin tier returns
// isAdmin: false. The check re-runs on focus so revocation takes effect
// next time the user returns to the page.

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_AVA_API_URL || 'https://avasupernova.com';

export interface AdminTierState {
  isAdmin: boolean;
  loading: boolean;
  tier: string | null;
}

function getPlatformKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('ava-companion-platform-key');
  } catch {
    return null;
  }
}

export function useAdminTier(): AdminTierState {
  const [state, setState] = useState<AdminTierState>({
    isAdmin: false, loading: true, tier: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      const key = getPlatformKey();
      if (!key) {
        if (!cancelled) setState({ isAdmin: false, loading: false, tier: null });
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/usage/summary`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const tier = data.tier ?? null;
        if (!cancelled) setState({ isAdmin: tier === 'admin', loading: false, tier });
      } catch {
        // Fail closed — any error → not admin
        if (!cancelled) setState({ isAdmin: false, loading: false, tier: null });
      }
    }

    check();
    const onFocus = () => { check(); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, []);

  return state;
}
