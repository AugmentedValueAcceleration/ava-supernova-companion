'use client';

// ─── Phase E: Companion Desktop Automation UI ─────────────────────────────
//
// E1: Sessions list + pair request flow
// E2: Mobile trajectory view (step stream, budget header)
// E3: Mobile approval cards (full-screen takeover)
// E4: Take-back-control handling (desktop flips us to read-only)
//
// Admin-gated at the route level — this component assumes the caller
// has already verified tier=admin before rendering.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createDesktopChannel } from '../lib/desktop-channel';

// ── Inline type copies (companion doesn't import @ava/core) ───────────────
interface Session {
  sessionId: string;
  deviceName: string;
  platform: string;
  version: string;
  lastHeartbeat: number;
}

interface StepView {
  step: number;
  narratorLine: string;
  budgetHeader: string;
  plannerKind: string;
  verifierStatus: string;
}

interface ApprovalState {
  nonce: string;
  summary: string;
  reversible: boolean;
  kind: string;
  target?: string;
  reasoning: string;
}

type Phase = 'sessions' | 'pairing' | 'paired' | 'takenBack';

interface Props {
  userId: string;
  deviceName: string;
}

// ── Theme (matches companion's existing look) ─────────────────────────────
const theme = {
  bg: '#0f0f14',
  surface: '#1a1a22',
  border: '#2a2a35',
  text: '#e4e4e7',
  textMuted: '#71717a',
  accent: '#8b5cf6',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',
};

export default function DesktopPairingPanel({ userId, deviceName }: Props) {
  const [phase, setPhase] = useState<Phase>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pairedSessionId, setPairedSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [budgetHeader, setBudgetHeader] = useState('');
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [intent, setIntent] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  // Stable fingerprint for this device — used to register pair requests
  const fingerprint = useMemo(() => {
    if (typeof window === 'undefined') return 'ssr';
    try {
      const stored = localStorage.getItem('ava-companion-fingerprint');
      if (stored) return stored;
      const fresh = crypto.randomUUID();
      localStorage.setItem('ava-companion-fingerprint', fresh);
      return fresh;
    } catch { return crypto.randomUUID(); }
  }, []);

  // ── Channel lifecycle ────────────────────────────────────────────
  useEffect(() => {
    const channel = createDesktopChannel(userId);
    const unsub = channel.subscribe((msg) => {
      switch (msg.type) {
        case 'session.register': {
          const m = msg as unknown as { sessionId: string; deviceName: string; platform: string; version: string };
          setSessions(prev => {
            const existing = prev.find(s => s.sessionId === m.sessionId);
            if (existing) {
              return prev.map(s => s.sessionId === m.sessionId ? { ...s, lastHeartbeat: Date.now() } : s);
            }
            return [...prev, { ...m, lastHeartbeat: Date.now() }];
          });
          break;
        }
        case 'session.heartbeat': {
          const m = msg as unknown as { sessionId: string };
          setSessions(prev => prev.map(s => s.sessionId === m.sessionId ? { ...s, lastHeartbeat: Date.now() } : s));
          break;
        }
        case 'session.end': {
          const m = msg as unknown as { sessionId: string };
          setSessions(prev => prev.filter(s => s.sessionId !== m.sessionId));
          if (pairedSessionId === m.sessionId) {
            setPhase('sessions');
            setPairedSessionId(null);
            setNotice('Desktop session ended.');
          }
          break;
        }
        case 'pair.grant': {
          const m = msg as unknown as { sessionId: string };
          if (phase === 'pairing') {
            setPairedSessionId(m.sessionId);
            setPhase('paired');
            setNotice(null);
          }
          break;
        }
        case 'pair.deny': {
          const m = msg as unknown as { reason: string };
          setPhase('sessions');
          setNotice(`Pair denied: ${m.reason.replace(/_/g, ' ')}`);
          break;
        }
        case 'pair.takeback': {
          if (phase === 'paired') {
            setPhase('takenBack');
            setNotice('Desktop took back control.');
          }
          break;
        }
        case 'traj.step': {
          const m = msg as unknown as {
            stepNumber: number; narratorLine: string; budgetHeader: string;
            personas: { planner: { kind: string }; verifier: { status: string } };
          };
          setSteps(prev => [...prev, {
            step: m.stepNumber,
            narratorLine: m.narratorLine,
            budgetHeader: m.budgetHeader,
            plannerKind: m.personas.planner.kind,
            verifierStatus: m.personas.verifier.status,
          }]);
          setBudgetHeader(m.budgetHeader);
          break;
        }
        case 'approval.request': {
          const m = msg as unknown as {
            nonce: string; summary: string; reversible: boolean;
            action: { kind: string; target?: string; reasoning: string };
          };
          setApproval({
            nonce: m.nonce, summary: m.summary, reversible: m.reversible,
            kind: m.action.kind, target: m.action.target, reasoning: m.action.reasoning,
          });
          break;
        }
      }
    });

    // Prune stale sessions (no heartbeat in 60s)
    const prune = setInterval(() => {
      setSessions(prev => prev.filter(s => Date.now() - s.lastHeartbeat < 60_000));
    }, 15_000);

    return () => { unsub(); channel.teardown(); clearInterval(prune); };
  }, [userId, phase, pairedSessionId]);

  // Auto-scroll
  useEffect(() => {
    stepsRef.current?.scrollTo({ top: stepsRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps, approval]);

  // ── Actions ──────────────────────────────────────────────────────
  // NOTE: sessionId is accepted from the caller (pair(s.sessionId)) but the
  // pair.request broadcast below doesn't carry it — the desktop isn't told
  // which session to pair to. Left as-is (renamed to satisfy lint) pending a
  // protocol review; pairing currently keys on userId + device fingerprint.
  async function pair(_sessionId: string): Promise<void> {
    const channel = createDesktopChannel(userId);
    await channel.broadcast({
      type: 'pair.request',
      from: 'companion',
      ts: new Date().toISOString(),
      deviceFingerprint: fingerprint,
      deviceName,
    });
    setPhase('pairing');
    setNotice('Waiting for desktop to accept...');
  }

  async function sendIntent(): Promise<void> {
    const trimmed = intent.trim();
    if (!trimmed || !pairedSessionId) return;
    const channel = createDesktopChannel(userId);
    await channel.broadcast({
      type: 'traj.intent',
      from: 'companion',
      ts: new Date().toISOString(),
      text: trimmed,
    });
    setIntent('');
  }

  async function respondToApproval(approved: boolean): Promise<void> {
    if (!approval) return;
    const channel = createDesktopChannel(userId);
    await channel.broadcast({
      type: 'approval.response',
      from: 'companion',
      ts: new Date().toISOString(),
      nonce: approval.nonce,
      approved,
    });
    setApproval(null);
  }

  async function sendKill(level: 'pause' | 'stop' | 'panic'): Promise<void> {
    if (!pairedSessionId) return;
    const channel = createDesktopChannel(userId);
    await channel.broadcast({
      type: 'kill',
      from: 'companion',
      ts: new Date().toISOString(),
      sessionId: pairedSessionId,
      level,
    });
  }

  // ── Render ───────────────────────────────────────────────────────

  // E3: Full-screen approval takeover
  if (approval) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: theme.bg, color: theme.text, display: 'flex', flexDirection: 'column', padding: 24, zIndex: 1000 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.orange, marginBottom: 16 }}>⚠ Approval needed</div>
        <div style={{ fontSize: 17, color: theme.text, marginBottom: 16, lineHeight: 1.4 }}>{approval.summary}</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>
          <div><b>Action:</b> {approval.kind}{approval.target ? ` → ${approval.target}` : ''}</div>
          <div><b>Why:</b> {approval.reasoning}</div>
        </div>
        {!approval.reversible && (
          <div style={{ fontSize: 13, color: theme.red, fontWeight: 600, padding: 12, background: theme.red + '15', borderRadius: 8, marginBottom: 16 }}>
            This action cannot be undone.
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => respondToApproval(true)}
            style={{ padding: '16px 20px', borderRadius: 12, fontSize: 16, fontWeight: 600, background: theme.green, color: theme.bg, border: 'none' }}>
            Approve
          </button>
          <button onClick={() => respondToApproval(false)}
            style={{ padding: '16px 20px', borderRadius: 12, fontSize: 16, background: 'transparent', color: theme.red, border: `2px solid ${theme.red}` }}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  // E1: Sessions list
  if (phase === 'sessions' || phase === 'pairing') {
    return (
      <div style={{ padding: 20, color: theme.text }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Desktop Automation</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>
          Pair with your desktop IDE to drive trajectories remotely.
        </div>

        {notice && (
          <div style={{ padding: 12, borderRadius: 8, background: theme.surface, color: theme.textMuted, marginBottom: 16, fontSize: 13 }}>
            {notice}
          </div>
        )}

        {sessions.length === 0 ? (
          <div style={{ padding: 32, borderRadius: 12, background: theme.surface, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💻</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No desktop sessions online</div>
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
              Start Ava Supernova IDE on your computer and enter desktop mode (@@) to see it here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map(s => (
              <button key={s.sessionId}
                onClick={() => pair(s.sessionId)}
                disabled={phase === 'pairing'}
                style={{
                  padding: 16, borderRadius: 12, background: theme.surface,
                  border: `1px solid ${theme.border}`, color: theme.text,
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: phase === 'pairing' ? 'wait' : 'pointer',
                  opacity: phase === 'pairing' ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 24 }}>💻</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.deviceName}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    {s.platform} · v{s.version}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: theme.accent }}>Pair →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // E4: Take-back banner (read-only)
  if (phase === 'takenBack') {
    return (
      <div style={{ padding: 20, color: theme.text, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Control taken back</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          The desktop user has resumed local control. Your session is read-only.
        </div>
        <button onClick={() => { setPhase('sessions'); setPairedSessionId(null); setSteps([]); }}
          style={{ padding: '10px 18px', borderRadius: 8, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, fontSize: 13 }}>
          Back to sessions
        </button>
      </div>
    );
  }

  // E2: Paired — trajectory view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', color: theme.text, background: theme.bg }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>Paired</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {sessions.find(s => s.sessionId === pairedSessionId)?.deviceName ?? 'Desktop'}
        </div>
        {budgetHeader && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{budgetHeader}</div>
        )}
      </div>

      {/* Steps stream */}
      <div ref={stepsRef} style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {steps.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
            Waiting for desktop to start a trajectory...
          </div>
        ) : steps.map(s => (
          <div key={s.step} style={{ padding: 12, borderRadius: 10, background: theme.surface, marginBottom: 8 }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{s.narratorLine}</div>
            <div style={{ fontSize: 10, color: theme.textMuted, display: 'flex', gap: 10 }}>
              <span>step {s.step}</span>
              <span>{s.plannerKind}</span>
              <span style={{ color: s.verifierStatus === 'verified' ? theme.green : theme.yellow }}>
                {s.verifierStatus}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Intent input + kill */}
      <div style={{ padding: 12, borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={intent}
          onChange={e => setIntent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendIntent(); }}
          placeholder="Send a command..."
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 8,
            background: theme.surface, border: `1px solid ${theme.border}`,
            color: theme.text, fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={sendIntent}
          style={{ padding: '10px 14px', borderRadius: 8, background: theme.accent, color: theme.bg, border: 'none', fontSize: 13, fontWeight: 600 }}>
          Send
        </button>
      </div>

      {/* Big thumb-reach stop button */}
      <button onClick={() => sendKill('stop')}
        style={{ padding: '14px 16px', background: theme.red, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
        ■ Stop
      </button>
    </div>
  );
}
