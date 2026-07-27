'use client';

// ─── Health Profile (Phase 3) ───────────────────────────────────────────────
//
// Everything generation actually plans against: body, goal, sleep, kitchen,
// training and constraints. Local-first, synced across surfaces via
// health-profile-store.
//
// Constraints, training and kitchen used to round-trip without an editor —
// they existed on the type, synced, and fed the server's pool filtering, but
// there was nowhere to type them in. So they were always null, and everything
// downstream quietly assumed one person, unlimited evenings and no allergies.
// A companion-only user got the least safe version of the health features,
// because the extension was the only place those fields could be set.
//
// Allergens, diets, injuries and kit come from the library's own taxonomies,
// so the words stored here are the same words the pool filters on.
//
// Still missing, deliberately: baseline lifts and weight history (both are
// repeating sub-forms, not fields) and cost_tier.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { t, useLocale } from '@/lib/i18n';
import { loadProfile, saveProfile, syncProfile } from '@/lib/health-profile-store';
import { CustomSelect } from './CustomSelect';
import { DateField } from './DateField';
import { healthCatalogApi } from '@/lib/api';
import { emptyHealthProfile, type HealthProfile, type HealthGoal, type CookingLevel, type TrainingExperience, type Weekday } from '@/lib/health-types';
import type { StringKey } from '@/locales/en';

function goalLabel(g: HealthGoal): string {
  switch (g) {
    case 'fat_loss':    return t('plansGoalFatLoss');
    case 'muscle_gain': return t('plansGoalMuscleGain');
    case 'maintenance': return t('plansGoalMaintenance');
    case 'athletic':    return t('plansGoalAthletic');
    case 'recovery':    return t('plansGoalRecovery');
    case 'longevity':   return t('plansGoalLongevity');
  }
}
const GOALS: HealthGoal[] = ['fat_loss', 'muscle_gain', 'maintenance', 'athletic', 'recovery', 'longevity'];

const inputCls = 'w-full bg-ava-surface border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ava-purple focus:outline-none';

export function ProfileView({ token }: { token?: string | null }) {
  useLocale();
  const [profile, setProfile] = useState<HealthProfile>(() => loadProfile() ?? emptyHealthProfile());
  const [saved, setSaved] = useState(false);

  // Pull the freshest copy on open (no-op offline / local mode / guest).
  useEffect(() => {
    let live = true;
    syncProfile(token).then(p => { if (live && p) setProfile(p); }).catch(() => {});
    return () => { live = false; };
  }, [token]);

  const save = useCallback(() => {
    setProfile(prev => {
      const next = saveProfile(prev);
      syncProfile(token).catch(() => {});
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, [token]);

  const setBody = (patch: Partial<HealthProfile['body']>) => setProfile(p => ({ ...p, body: { ...p.body, ...patch } }));
  const setGoals = (patch: Partial<HealthProfile['goals']>) => setProfile(p => ({ ...p, goals: { ...p.goals, ...patch } }));
  const setSleep = (patch: Partial<HealthProfile['schedule']['sleep_target']>) =>
    setProfile(p => ({ ...p, schedule: { ...p.schedule, sleep_target: { ...p.schedule.sleep_target, ...patch } } }));

  // The sections that actually drive generation. Optional on the type because
  // core, the extension and the IDE predate them, so every setter fills in a
  // whole object rather than patching one that may not be there.
  const setConstraints = (patch: Partial<HealthProfile['constraints']>) =>
    setProfile(p => ({ ...p, constraints: { ...p.constraints, ...patch } }));
  const setTraining = (patch: Partial<NonNullable<HealthProfile['training']>>) =>
    setProfile(p => ({
      ...p,
      training: {
        experience: null, days_per_week: null, training_days: [], baseline_lifts: [],
        ...(p.training ?? {}), ...patch,
      },
    }));
  const setKitchen = (patch: Partial<NonNullable<HealthProfile['kitchen']>>) =>
    setProfile(p => ({
      ...p,
      kitchen: {
        level: null, minutes_weekday: null, minutes_weekend: null,
        household_size: null, cost_tier: null,
        ...(p.kitchen ?? {}), ...patch,
      },
    }));

  const num = (v: string): number | null => { const n = Number(v); return v.trim() && Number.isFinite(n) ? n : null; };

  // Allergens, diets, injuries and kit come from the library's own taxonomies
  // rather than a hard-coded list, so the words a profile stores are the same
  // words the pool filters on. Failure is silent: the rest of the profile
  // still edits, those pickers simply have nothing to offer.
  const [tax, setTax] = useState<Taxonomies>({ allergens: [], diets: [], contraindications: [], equipment: [] });
  useEffect(() => {
    let live = true;
    healthCatalogApi.taxonomies()
      .then((r: Partial<Taxonomies>) => {
        if (!live) return;
        setTax({
          allergens: r.allergens ?? [], diets: r.diets ?? [],
          contraindications: r.contraindications ?? [], equipment: r.equipment ?? [],
        });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl md:max-w-4xl mx-auto w-full pb-28">
        <div className="px-4 py-3 border-b border-ava-border">
          <h2 className="font-semibold text-white text-lg">{t('profileHeading')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('profileDescription')}</p>
        </div>
        <div className="px-4 py-4 space-y-6">
          <Section title={t('profileBodySection')}>
            <Field label={t('profileSexLabel')}>
              <CustomSelect
                value={profile.body.sex ?? ''}
                onChange={v => setBody({ sex: (v || null) as HealthProfile['body']['sex'] })}
                options={[
                  { value: '', label: '—' },
                  { value: 'female', label: t('profileSexFemale') },
                  { value: 'male', label: t('profileSexMale') },
                  { value: 'other', label: t('profileSexOther') },
                ]}
              />
            </Field>
            <Field label={t('profileDobLabel')}>
              <DateField value={profile.body.date_of_birth ?? null} onChange={v => setBody({ date_of_birth: v })} className={inputCls} />
            </Field>
            <Field label={t('profileHeightLabel')}>
              <HeightField cm={profile.body.height_cm} onChange={v => setBody({ height_cm: v })} />
            </Field>
            <Field label={t('profileWeightLabel')}>
              <WeightField kg={profile.body.weight_kg} onChange={v => setBody({ weight_kg: v })} />
            </Field>
            <Field label={t('profileBodyFatLabel')}>
              <input inputMode="decimal" value={profile.body.body_fat_pct ?? ''} onChange={e => setBody({ body_fat_pct: num(e.target.value) })} className={inputCls} />
            </Field>
          </Section>

          <Section title={t('profileGoalSection')}>
            <Field label={t('profilePrimaryGoalLabel')}>
              <CustomSelect
                value={profile.goals.primary ?? ''}
                onChange={v => setGoals({ primary: (v || null) as HealthGoal | null })}
                options={[{ value: '', label: '—' }, ...GOALS.map(v => ({ value: v, label: goalLabel(v) }))]}
              />
            </Field>
            <Field label={t('profileWeeklyFocusLabel')}>
              <input value={profile.goals.weekly_focus ?? ''} onChange={e => setGoals({ weekly_focus: e.target.value || null })} placeholder={t('profileWeeklyFocusPlaceholder')} className={inputCls} />
            </Field>
          </Section>

          <Section title={t('profileSleepTargetSection')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profileBedtimeLabel')}>
                <input type="time" value={profile.schedule.sleep_target.bedtime ?? ''} onChange={e => setSleep({ bedtime: e.target.value || null })} className={inputCls} />
              </Field>
              <Field label={t('profileWakeLabel')}>
                <input type="time" value={profile.schedule.sleep_target.wake ?? ''} onChange={e => setSleep({ wake: e.target.value || null })} className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* ── Kitchen ───────────────────────────────────────────────────
              Household size drives servings and therefore every quantity on a
              shopping list; the two time budgets are what decides whether a
              Tuesday is over its head. All of it existed on the type, was
              synced, and fed generation — with nowhere to type it in, so it
              was always null and everything downstream quietly assumed one
              person with unlimited evenings. */}
          <Section title={t('profileKitchenSection')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profileHouseholdLabel')}>
                <CustomSelect
                  value={profile.kitchen?.household_size != null ? String(profile.kitchen.household_size) : ''}
                  onChange={v => setKitchen({ household_size: v ? Number(v) : null })}
                  options={[{ value: '', label: '—' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ value: String(n), label: String(n) }))]}
                />
              </Field>
              <Field label={t('profileCookingLevelLabel')}>
                <CustomSelect
                  value={profile.kitchen?.level ?? ''}
                  onChange={v => setKitchen({ level: (v || null) as CookingLevel | null })}
                  options={[
                    { value: '', label: '—' },
                    { value: 'beginner', label: t('profileLevelBeginner') },
                    { value: 'intermediate', label: t('profileLevelIntermediate') },
                    { value: 'expert', label: t('profileLevelExpert') },
                  ]}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profileMinutesWeekdayLabel')}>
                <input inputMode="numeric" value={profile.kitchen?.minutes_weekday ?? ''}
                  onChange={e => setKitchen({ minutes_weekday: num(e.target.value) })}
                  placeholder="20" className={inputCls} />
              </Field>
              <Field label={t('profileMinutesWeekendLabel')}>
                <input inputMode="numeric" value={profile.kitchen?.minutes_weekend ?? ''}
                  onChange={e => setKitchen({ minutes_weekend: num(e.target.value) })}
                  placeholder="60" className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* ── Training ──────────────────────────────────────────────────
              Which days, not just how many: there was a training window per
              day but nothing saying Mon/Wed/Fri, and you cannot shape a week
              without it. */}
          <Section title={t('profileTrainingSection')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profileExperienceLabel')}>
                <CustomSelect
                  value={profile.training?.experience ?? ''}
                  onChange={v => setTraining({ experience: (v || null) as TrainingExperience | null })}
                  options={[
                    { value: '', label: '—' },
                    { value: 'beginner', label: t('profileLevelBeginner') },
                    { value: 'intermediate', label: t('profileLevelIntermediate') },
                    { value: 'advanced', label: t('profileLevelAdvanced') },
                  ]}
                />
              </Field>
              <Field label={t('profileDaysPerWeekLabel')}>
                <CustomSelect
                  value={profile.training?.days_per_week != null ? String(profile.training.days_per_week) : ''}
                  onChange={v => setTraining({ days_per_week: v ? Number(v) : null })}
                  options={[{ value: '', label: '—' }, ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ value: String(n), label: String(n) }))]}
                />
              </Field>
            </div>
            <Field label={t('profileTrainingDaysLabel')}>
              <div className="flex gap-1.5">
                {WEEKDAYS.map(d => {
                  const on = (profile.training?.training_days ?? []).includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTraining({ training_days: toggle(profile.training?.training_days ?? [], d) as Weekday[] })}
                      className={`flex-1 rounded-lg border py-2 text-[11px] capitalize transition ${
                        on ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'
                      }`}
                    >
                      {t(`profileDay_${d}` as StringKey)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* ── Constraints ───────────────────────────────────────────────
              The safety half. An allergen here removes recipes from the pool
              server-side, so it never reaches a plan — which is why this can
              never have been a text box. Empty means "not specified", never
              "none", so nothing is filtered on a blank. */}
          <Section title={t('profileConstraintsSection')}>
            <ChipField
              label={t('profileAllergensLabel')}
              hint={t('profileAllergensHint')}
              options={tax.allergens.map(a => ({ value: a.slug, label: a.name }))}
              selected={profile.constraints.allergens ?? []}
              onToggle={v => setConstraints({ allergens: toggle(profile.constraints.allergens ?? [], v) })}
            />
            <ChipField
              label={t('profileDietsLabel')}
              options={tax.diets.map(d => ({ value: d.slug, label: d.name }))}
              selected={profile.constraints.dietary ?? []}
              onToggle={v => setConstraints({ dietary: toggle(profile.constraints.dietary ?? [], v) })}
            />
            <ChipField
              label={t('profileInjuriesLabel')}
              hint={t('profileInjuriesHint')}
              options={tax.contraindications.map(c => ({ value: c.slug, label: c.name }))}
              selected={profile.constraints.injuries ?? []}
              onToggle={v => setConstraints({ injuries: toggle(profile.constraints.injuries ?? [], v) })}
            />
            <ChipField
              label={t('profileEquipmentLabel')}
              hint={t('profileEquipmentHint')}
              // Stored by NAME, not slug: the exercise check compares the
              // profile against each exercise's equipment names. Storing a
              // slug here would silently match nothing.
              options={tax.equipment.map(e => ({ value: e.name, label: e.name }))}
              selected={profile.constraints.equipment_available ?? []}
              onToggle={v => setConstraints({ equipment_available: toggle(profile.constraints.equipment_available ?? [], v) })}
            />
          </Section>

          <button onClick={save} className="w-full rounded-full bg-ava-purple py-3 text-sm font-semibold text-white hover:bg-ava-purple-dark transition">
            {saved ? t('profileSaveButtonSaved') : t('profileSaveButtonDefault')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaxItem { slug: string; name: string }
interface Taxonomies {
  allergens: TaxItem[];
  diets: TaxItem[];
  contraindications: TaxItem[];
  equipment: TaxItem[];
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * A set of things you pick several of.
 *
 * Chips rather than a multi-select, because on a phone the whole point is
 * seeing what is already on without opening anything — and because an allergen
 * you cannot see you have selected is an allergen you cannot trust.
 *
 * Renders nothing when the library gave us no options: an empty box labelled
 * "Allergens" reads as "you have none", which is the opposite of the truth.
 */
function ChipField({ label, hint, options, selected, onToggle }: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div>
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {hint && <span className="block text-[10px] text-gray-600 mb-1.5">{hint}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${
                on
                  ? 'border-ava-purple bg-ava-purple/15 text-ava-purple-light'
                  : 'border-ava-border text-gray-400 active:scale-95'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

// A small labelled number cell — the unit columns for height/weight.
function NumberCell({ label, value, onChange, placeholder, step }: {
  label: string; value: number | null; onChange: (n: number | null) => void; placeholder?: string; step?: number;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <input
        type="number"
        step={step ?? 1}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => { const v = e.target.value.trim(); onChange(v === '' ? null : Number(v)); }}
        className="w-full bg-ava-surface border border-ava-border rounded-lg px-2 py-2 text-sm text-white placeholder-gray-600 focus:border-ava-purple focus:outline-none"
      />
    </div>
  );
}

// Height — canonical cm, chosen from a list in whichever unit you think in.
//
// Was three number boxes side by side (cm, ft, in) all live at once, which
// asked you to know your height in both systems and left the other two boxes
// arguing with the one you typed in. Height is a value from a short, fixed
// range that never changes — a list you pick from is faster than typing, and
// cannot be half-entered.
//
// Storage is unchanged: cm remains canonical, so nothing that reads a profile
// has to care which unit was used to enter it. In imperial the list's own
// values are INCHES, not centimetres, so switching units never has to find a
// nearest match — 5'9" is 175 cm going one way and 69 inches coming back.

type HeightUnit = 'cm' | 'imperial';

const HEIGHT_UNIT_KEY = 'ava-health-height-unit';

function readHeightUnit(): HeightUnit {
  try { return localStorage.getItem(HEIGHT_UNIT_KEY) === 'imperial' ? 'imperial' : 'cm'; }
  catch { return 'cm'; }
}

// Wide enough to cover every adult and most of childhood; a range that cuts
// someone off is worse than a slightly longer scroll, and the list opens
// already scrolled to whatever is selected.
const CM_RANGE = { min: 100, max: 250 };
const IN_RANGE = { min: 39, max: 98 };

function HeightField({ cm, onChange }: { cm: number | null; onChange: (cm: number | null) => void }) {
  const [unit, setUnit] = useState<HeightUnit>('cm');

  // Read after mount: localStorage does not exist during the static export's
  // prerender, and a value read at render time would not match the server's.
  useEffect(() => { setUnit(readHeightUnit()); }, []);

  const pickUnit = (u: HeightUnit) => {
    setUnit(u);
    try { localStorage.setItem(HEIGHT_UNIT_KEY, u); } catch { /* private mode */ }
  };

  const options = useMemo(() => {
    const blank = { value: '', label: '—' };
    if (unit === 'cm') {
      const out = [blank];
      for (let v = CM_RANGE.min; v <= CM_RANGE.max; v++) out.push({ value: String(v), label: `${v} cm` });
      return out;
    }
    const out = [blank];
    for (let i = IN_RANGE.min; i <= IN_RANGE.max; i++) {
      out.push({ value: String(i), label: `${Math.floor(i / 12)}′ ${i % 12}″` });
    }
    return out;
  }, [unit]);

  const value = cm == null || !Number.isFinite(cm)
    ? ''
    : unit === 'cm' ? String(Math.round(cm)) : String(Math.round(cm / 2.54));

  const change = (v: string) => {
    if (!v) { onChange(null); return; }
    const n = Number(v);
    onChange(unit === 'cm' ? n : Math.round(n * 2.54));
  };

  return (
    <div className="flex gap-2">
      <div className="flex shrink-0 gap-1">
        <UnitBtn label="cm" active={unit === 'cm'} onClick={() => pickUnit('cm')} />
        <UnitBtn label="ft / in" active={unit === 'imperial'} onClick={() => pickUnit('imperial')} />
      </div>
      <CustomSelect
        value={value}
        onChange={change}
        options={options}
        placeholder={unit === 'cm' ? '178 cm' : '5′ 10″'}
        className="flex-1 min-w-0"
      />
    </div>
  );
}

function UnitBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 text-[11px] ${
        active ? 'border-ava-purple bg-ava-purple/10 text-ava-purple-light' : 'border-ava-border text-gray-400'
      }`}
    >
      {label}
    </button>
  );
}

// Weight — canonical kg (1 dp), with live lbs + stone/lb cells.
function WeightField({ kg, onChange }: { kg: number | null; onChange: (kg: number | null) => void }) {
  let lbs: number | null = null;
  let stone: number | null = null;
  let stoneLb: number | null = null;
  if (kg != null && Number.isFinite(kg)) {
    lbs = Math.round(kg * 2.20462);
    stone = Math.floor(lbs / 14);
    stoneLb = lbs % 14;
  }
  const kgFromLbs = (totalLbs: number) => Math.round((totalLbs / 2.20462) * 10) / 10;
  const setLbs = (n: number | null) => onChange(n == null ? null : kgFromLbs(n));
  const setStone = (s: number | null, lb: number | null) => {
    if (s == null && lb == null) { onChange(null); return; }
    onChange(kgFromLbs((s ?? 0) * 14 + (lb ?? 0)));
  };
  return (
    <div className="grid grid-cols-4 gap-2">
      <NumberCell label="kg" value={kg} onChange={onChange} placeholder="78" step={0.1} />
      <NumberCell label="lbs" value={lbs} onChange={setLbs} placeholder="172" />
      <NumberCell label="st" value={stone} onChange={v => setStone(v, stoneLb)} placeholder="12" />
      <NumberCell label="lb" value={stoneLb} onChange={v => setStone(stone, v)} placeholder="4" />
    </div>
  );
}
