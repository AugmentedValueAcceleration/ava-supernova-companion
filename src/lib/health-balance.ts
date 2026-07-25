// ─── Movement balance ───────────────────────────────────────────────────────
//
// The exercise library carries movement_pattern, force_type, session_role and
// laterality on every entry. The plan generator has never seen any of it — it
// gets a flat list of ~280 exercise NAMES — so it cannot balance a week or
// order a session, and neither could someone building one by hand.
//
// This is the check both of them were missing. It is what separates "an LLM
// wrote a workout" from a programme: four presses and no hinge is a badly built
// week even when the muscle counts look even, and muscle data cannot show you
// that.
//
// Pure by design. The caller supplies the library metadata it has already
// loaded; this module does no I/O, so the same rules run server-side during
// generation and client-side while someone is composing.
//
// It advises. Nothing here rewrites a plan — a coach who knows they're doing a
// press-heavy block should be able to, having been told once.

/** The library fields this reasons over. All optional: an exercise with no
 *  pattern recorded is skipped rather than guessed at. */
export interface MovementMeta {
  movement_pattern?: string | null;
  force_type?: string | null;   // push | pull | static
  session_role?: string | null; // main | accessory | finisher | warmup | cooldown | mobility
  laterality?: string | null;
}

export interface BalanceFinding {
  kind: 'push_pull' | 'missing_hinge' | 'no_rest' | 'session_order' | 'repeated_pattern';
  /** warn = worth acting on; note = worth knowing. Neither blocks anything. */
  severity: 'warn' | 'note';
  message: string;
}

export interface BalanceDay {
  kind: 'training' | 'rest' | 'active_recovery';
  exercises: Array<{ name: string; meta?: MovementMeta | null }>;
}

/** Patterns that count as a hinge — the posterior-chain half of a leg week. */
const HINGE = new Set(['hinge']);
const SQUAT = new Set(['squat', 'lunge']);

const ORDER: Record<string, number> = {
  warmup: 0, mobility: 1, main: 2, accessory: 3, finisher: 4, cooldown: 5,
};

/**
 * Check a week (or any run of days) for the imbalances that actually matter.
 *
 * Kept to a handful of rules on purpose. A checker that fires on everything
 * gets ignored, and then it may as well not exist.
 */
export function checkWeekBalance(days: BalanceDay[]): BalanceFinding[] {
  const findings: BalanceFinding[] = [];
  const metas = days.flatMap(d => d.exercises.map(e => e.meta).filter(Boolean) as MovementMeta[]);
  if (metas.length === 0) return findings;

  // ── Push against pull ─────────────────────────────────────────────────────
  // The most common self-inflicted imbalance, and the one with the clearest
  // consequence for the shoulders.
  const push = metas.filter(m => m.force_type === 'push').length;
  const pull = metas.filter(m => m.force_type === 'pull').length;
  // Ratios are meaningless at low volume: two squats and one row is 2:1 and
  // means nothing. Testing had it firing on a single balanced day, which is how
  // a checker teaches people to ignore it. Require real volume on the heavier
  // side before passing comment.
  const MIN_TO_JUDGE = 4;
  if (push > 0 && pull > 0 && Math.max(push, pull) >= MIN_TO_JUDGE
      && (push >= pull * 2 || pull >= push * 2)) {
    const heavier = push > pull ? 'pushing' : 'pulling';
    findings.push({
      kind: 'push_pull', severity: 'warn',
      message: `Weighted toward ${heavier} — ${push} push to ${pull} pull.`,
    });
  } else if (push >= MIN_TO_JUDGE && pull === 0) {
    findings.push({
      kind: 'push_pull', severity: 'warn',
      message: `${push} pushing movements and nothing pulling.`,
    });
  }

  // ── Squatting without hinging ─────────────────────────────────────────────
  // Quads without posterior chain. Muscle counts can look even and still miss
  // this, which is exactly why the pattern field exists.
  const patterns = new Set(metas.map(m => m.movement_pattern).filter(Boolean) as string[]);
  const squats = [...patterns].some(p => SQUAT.has(p));
  const hinges = [...patterns].some(p => HINGE.has(p));
  if (squats && !hinges) {
    findings.push({
      kind: 'missing_hinge', severity: 'warn',
      message: 'Squats and lunges but no hinge — nothing here trains the posterior chain.',
    });
  }

  // ── Rest ──────────────────────────────────────────────────────────────────
  const training = days.filter(d => d.kind === 'training').length;
  const rest = days.filter(d => d.kind !== 'training').length;
  if (days.length >= 7 && rest === 0) {
    findings.push({
      kind: 'no_rest', severity: 'warn',
      message: `${training} training days with no rest or recovery day.`,
    });
  }

  // ── The same pattern on consecutive days ──────────────────────────────────
  for (let i = 1; i < days.length; i++) {
    const prev = new Set(days[i - 1].exercises.map(e => e.meta?.movement_pattern).filter(Boolean) as string[]);
    const cur = days[i].exercises.map(e => e.meta?.movement_pattern).filter(Boolean) as string[];
    const shared = [...new Set(cur.filter(p => prev.has(p)))].filter(p => p !== 'mobility' && p !== 'isolation');
    if (shared.length >= 2) {
      findings.push({
        kind: 'repeated_pattern', severity: 'note',
        message: `Days ${i} and ${i + 1} repeat the same patterns (${shared.join(', ')}) — little recovery between them.`,
      });
      break; // say it once; a week of this doesn't need saying five times
    }
  }

  return findings;
}

/**
 * Is a session ordered the way a coach would write it?
 *
 * Heavy work belongs before the things that fatigue you for it. Without
 * session_role a plan can pick exercises but cannot sequence them, which is how
 * squats end up after the finisher.
 */
export function checkSessionOrder(
  exercises: Array<{ name: string; meta?: MovementMeta | null }>,
): BalanceFinding[] {
  const ranked = exercises
    .map((e, i) => ({ i, name: e.name, rank: ORDER[e.meta?.session_role ?? ''] }))
    .filter(x => x.rank != null);
  if (ranked.length < 2) return [];

  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i].rank < ranked[i - 1].rank) {
      return [{
        kind: 'session_order', severity: 'note',
        message: `${ranked[i].name} usually comes before ${ranked[i - 1].name}.`,
      }];
    }
  }
  return [];
}
