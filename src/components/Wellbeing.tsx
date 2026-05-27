'use client';

import { WorkoutsBrowse, RecipesBrowse } from './CatalogBrowse';
import { ProfileView } from './ProfileView';
import { TodayView } from './TodayView';
import { PlansView } from './PlansView';

// ─── Wellbeing section host (Phase 1 shell) ─────────────────────────────────
//
// The five wellbeing destinations the ✦ quick-action sheet routes to. Phase 1
// stands these up as honest placeholders so the nav is fully walkable end to
// end; later phases replace each body with the real screen:
//   • Today   → Phase 3 (daily dashboard + logging)
//   • Recipes → Phase 2 (catalogue browse)
//   • Workouts→ Phase 2 (catalogue browse)
//   • Plans   → Phase 4 (library + creation, manual + via Ava)
//   • Gym     → Phase 5 (interval/rest timer — "Ava as gym partner")

export type WellbeingView = 'today' | 'gym' | 'plans' | 'recipes' | 'workouts' | 'profile';

const SECTION: Record<WellbeingView, { title: string; tagline: string; phase: string }> = {
  today:    { title: 'Today',    tagline: 'Your morning brief, logging, and how you’re tracking.', phase: 'Phase 3' },
  recipes:  { title: 'Recipes',  tagline: 'Browse the recipe library with full nutrition.',            phase: 'Phase 2' },
  workouts: { title: 'Workouts', tagline: 'Browse exercises across every training style.',              phase: 'Phase 2' },
  plans:    { title: 'Plans',    tagline: 'Your programs — build one yourself or ask Ava.',         phase: 'Phase 4' },
  gym:      { title: 'Gym',      tagline: 'Ava walks you through today’s session, set by set.',     phase: 'Phase 5' },
  profile:  { title: 'Profile',  tagline: 'Body stats, goals and schedule — what Ava plans around.', phase: 'Phase 3' },
};

export function WellbeingSection({ view, token }: { view: WellbeingView; token?: string | null }) {
  // Phase 2: Recipes + Workouts are live, paginated catalogue browsers.
  if (view === 'workouts') return <WorkoutsBrowse />;
  if (view === 'recipes') return <RecipesBrowse />;
  // Phase 3: Profile + Today are live.
  if (view === 'profile') return <ProfileView token={token} />;
  if (view === 'today') return <TodayView token={token} />;
  // Phase 4a-i: Plans library (manual create + calendar; day composition next).
  if (view === 'plans') return <PlansView token={token} />;

  // The rest stay as Phase-N placeholders until their phase lands.
  const meta = SECTION[view];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full">
        <div className="px-4 py-3 border-b border-ava-border">
          <h2 className="font-semibold text-white text-lg">{meta.title}</h2>
        </div>
        <div className="px-4 py-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-ava-purple/15 border border-ava-purple/30 flex items-center justify-center mb-4">
            <SectionGlyph view={view} />
          </div>
          <p className="text-gray-300 text-sm max-w-xs leading-relaxed">{meta.tagline}</p>
          <span className="mt-4 text-[10px] uppercase tracking-wider text-gray-500 bg-ava-surface border border-ava-border rounded-full px-3 py-1">
            Coming together &middot; {meta.phase}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionGlyph({ view }: { view: WellbeingView }) {
  const cls = 'w-7 h-7 text-ava-purple-light';
  switch (view) {
    case 'today':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
    case 'gym':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'plans':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case 'recipes':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 3 3 4-5" /></svg>;
    case 'workouts':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.5 6.5l11 11M5 8l-1.5-1.5M19 16l1.5 1.5M8 5L6.5 3.5M16 19l1.5 1.5M4 12h16" /></svg>;
    case 'profile':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
  }
}
