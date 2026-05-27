# Companion Wellbeing — 1.0 Build Plan

**Status:** Planning (no code yet) · **Decided:** in 1.0 scope (2026-05-26)
**Goal:** Evolve the companion from a chat box into mobile productivity + wellbeing — "Ava in your pocket," culminating in a Capacitor-wrapped native app.

---

## 1. Scope

In scope for 1.0:
- A **Wellbeing** area in the companion: Today · Recipes · Workouts · Plans · Gym
- **Plan creation both ways** — manual compose *and* via Ava (mirrors the extension)
- **Gym** — interval/rest timer, "Ava as gym partner," **companion-only**
- **Capacitor wrap** — final step, turns the PWA into a native iOS/Android app
- Chat + Settings stay exactly as they are; productivity (tasks/journal/memory) untouched

Out of scope:
- New health *capabilities* not already in the extension (we mirror, not invent — except Gym)
- Desktop/IDE changes (Gym is companion-only by nature)

---

## 2. Architecture (verified against current code)

| Layer | Where | Notes |
|---|---|---|
| Shared types | `core/src/health/types.ts` | `HealthPlan*`, `HealthPlanSource = 'manual' \| 'ava'`, statuses draft/active/completed/archived |
| Store contract | `core/src/health/store.ts` | `HealthPlanStore` interface — each surface implements its own |
| Catalogue + brief | platform `/api/health/*` | exercises, recipes, taxonomies, morning-brief, profile/sync — already live |
| Companion persistence | `lib/data-mode.ts` | `DataMode` local/cloud/both, **defaults cloud**; `X-Ava-Data-Mode` header |
| Companion ↔ backend | `lib/api.ts` | `API_BASE = ava-supernova.com/api`; `/companion/chat` for chat |

**The companion will need its own `HealthPlanStore` implementation** (like the extension's `health-plan-store-impl.ts`), backed by localStorage + cloud sync per `DataMode`.

### DECISION 1 — Cross-surface plan sync (blocking)
There is **no `/api/health/plans` endpoint**. Extension plans are local-only today.
- **Option A (correct):** Build `/api/health/plans` sync (mirrors the existing `/profile/sync` pattern); every surface's store syncs through it respecting `DataMode`. Delivers the "same plan everywhere" promise. Touches platform + core + all surfaces.
- **Option B (fast):** Companion plans local-only for now; defer cross-surface sync post-1.0. Breaks the multi-surface promise the deck makes.
- **Recommendation:** A. The whole pitch is "same memory, every surface." Profile already syncs — plans should too.
- **DECIDED (Option A built).** Refinement (2026-05-27): health data (plans + profile + logs) is **LOCAL BY DEFAULT** — sync only runs when the user opts in via `healthSyncEnabled()` (off by default), decoupled from the global chat data-mode. The opt-in toggle + tier storage-capacity gating are deferred to the whole-app settings pass. The sync infra (endpoint + store + reconcile) is in place and dormant until enabled.

---

## 3. Screens

**Nav:** `[Chat] [Tasks] [✦ Wellbeing] [Journal] [More]` — center hero button.
Tapping ✦ opens a **quick-action sheet**: Today / Gym / Plans / Recipes / Workouts (one tap each).
`More` holds Memory / Personality / Support / Settings.

1. **Today** — mirror of extension `HealthDashboard`: morning brief, log meal/water/sleep/mood, readiness/nutrition/training-load, today's plan slice.
2. **Recipes** — browse `/api/health/recipes` catalogue (with nutrition), search + filter by course.
3. **Workouts** — browse `/api/health/exercises` catalogue, filter by the 11 training types.
4. **Plans** — library (calendar + programs) + creation overlay (manual) + "ask Ava" (chat).
5. **Gym** — the timer (§5).

---

## 4. Plan creation (mirror the extension exactly)

- **Manual:** type → duration (1/7/28/56/84) → compose days from catalogue (slug-linked). Status draft/active — ask, never default.
- **Via Ava:** chat triggers the three core tools — `health_catalogue_search` → `health_plan_create` → `health_plan_update_day`. Catalogue-first, slug-linked, confirm before create, activating archives the existing active plan.
- Both produce the same `HealthPlan` object; `source` records which path made it.

---

## 5. Gym flow — the headline feature (companion-only)

The "Ava as gym partner" moment:
1. Open **Gym** → loads **today's training from the active plan**.
2. Walks the user **set-by-set**: work interval → rest interval, with audible/haptic cues.
3. Ava narrates between sets — knows the plan, the goal, the last session (her voice identity applies).
4. On finish, **logs completion back to the plan day** so the plan stays honest.

Open design questions (§7): interval/EMOM/Tabata modes? offline-capable (you're at a gym with bad signal)? wake-lock so the screen stays on?

---

## 6. Phased sequencing (build order)

- **Phase 0 — Foundation:** companion `HealthPlanStore` impl + DECISION 1 (sync). *Everything leans on this.*
- **Phase 1 — Nav shell:** `[Chat][Tasks][✦][Journal][More]` + wellbeing quick-action sheet.
- **Phase 2 — Catalogue screens:** Recipes + Workouts (read-only against existing APIs — lowest risk). **Must paginate** — catalogues are large; use offset-based paging (mirror the extension picker's `{ q, offset, category }` + total count) with a mobile "load more" / infinite-scroll pattern.
- **Phase 3 — Today:** daily dashboard mirror + logging.
- **Phase 4 — Plans:** library + manual creation + via-Ava.
- **Phase 5 — Gym:** the timer + Ava narration + logging.
- **Phase 6 — Capacitor wrap:** native iOS/Android build, wake-lock, haptics, notifications.

---

## 7. Open questions / decisions needed

1. **DECISION 1 — plan sync (A vs B)** — blocking, see §2.
2. **Gym timer modes** — just work/rest, or also EMOM/Tabata/AMRAP?
3. **Offline Gym** — must it run without signal? (affects Phase 0 caching).
4. **Capacitor timing** — wrap after each web phase is solid, or one wrap at the end?
5. **Parity audit** — confirm the companion mirrors the *current* extension health behaviour before each phase (extension is the reference).

---

## 8. References
- Extension manual builder: `packages/extension/dashboard-ui/src/pages/HealthPlans.tsx`
- Extension daily dashboard: `packages/extension/dashboard-ui/src/pages/HealthDashboard.tsx`
- Extension store impl: `packages/extension/src/webview/health-plan-store-impl.ts`
- Core tools: `packages/core/src/tools/health-plan-create.ts`, `health-plan-update-day.ts`, `health-catalogue-search.ts`
- Locked spec referenced by tools: `COMMAND_PALETTE_PLAN.md §10`
