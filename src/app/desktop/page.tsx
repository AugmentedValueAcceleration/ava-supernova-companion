'use client';

// Desktop automation companion route — admin-gated during testing.
// Non-admin users see "Coming soon". See memory: project_desktop_mode_rollout.md

import { useEffect, useState } from 'react';
import { useAdminTier } from '../../lib/useAdminTier';
import DesktopPairingPanel from '../../components/DesktopPairingPanel';
import { createClient } from '../../lib/supabase';

export default function DesktopPage() {
  const { isAdmin, loading } = useAdminTier();
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('Companion');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    try {
      const stored = localStorage.getItem('ava-companion-device-name');
      if (stored) setDeviceName(stored);
    } catch { /* */ }
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f14', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
        Checking access...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f14', color: '#e4e4e7',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Coming soon</div>
        <div style={{ fontSize: 13, color: '#71717a', maxWidth: 280, lineHeight: 1.5 }}>
          Desktop automation from the companion is in private testing. We&apos;ll announce
          the public rollout once the safety model is hardened.
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f14', color: '#e4e4e7', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Sign in required</div>
        <div style={{ fontSize: 12, color: '#71717a' }}>
          Sign in on the companion to pair with your desktop.
        </div>
      </div>
    );
  }

  return <DesktopPairingPanel userId={userId} deviceName={deviceName} />;
}
