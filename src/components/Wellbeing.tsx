'use client';

import { useState } from 'react';
import { WorkoutsBrowse, RecipesBrowse } from './CatalogBrowse';
import { ProfileView } from './ProfileView';
import { TodayView } from './TodayView';
import { PlansView } from './PlansView';
import { GymView } from './Gym';
import { t, useLocale } from '@/lib/i18n';

// ─── Wellbeing section host ─────────────────────────────────────────────────
//
// Routes the five wellbeing destinations to their real screens:
//   • Today    → daily dashboard + logging  (+ Profile sits behind a tab here)
//   • Recipes  → catalogue browse
//   • Workouts → catalogue browse
//   • Plans    → library + creation (manual + via Ava)
//   • Gym      → session entry + runner ("Ava as gym partner")

export type WellbeingView = 'today' | 'gym' | 'plans' | 'recipes' | 'workouts';

export function WellbeingSection({ view, token }: { view: WellbeingView; token?: string | null }) {
  if (view === 'workouts') return <WorkoutsBrowse />;
  if (view === 'recipes') return <RecipesBrowse />;
  if (view === 'plans') return <PlansView token={token} />;
  if (view === 'gym') return <GymView />;
  if (view === 'today') return <TodayProfilePage token={token} />;
  return null;
}

// ── Today + Profile in one tabbed page ──────────────────────────────────────
// Daily-use Today lives next to set-once-and-revisit Profile. One destination
// in the menu, two tabs inside.

function TodayProfilePage({ token }: { token?: string | null }) {
  useLocale();
  const [tab, setTab] = useState<'today' | 'profile'>('today');
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-3 flex items-center gap-2 border-b border-ava-border">
        <TabButton active={tab === 'today'}   onClick={() => setTab('today')}>{t('wellbeingTabToday')}</TabButton>
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>{t('wellbeingTabProfile')}</TabButton>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'today' ? <TodayView token={token} /> : <ProfileView token={token} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-[13px] transition ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
      {children}
      {active && <span className="absolute left-2 right-2 bottom-[-1px] h-[2px] bg-ava-purple rounded-full" />}
    </button>
  );
}
