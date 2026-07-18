'use client';

import { useState, useEffect } from 'react';
import { loadPersonality, savePersonality, resetPersonality } from '@/lib/personality';
import { t } from '@/lib/i18n';

// ── Option descriptors ─────────────────────────────────────────────────────

// `value` is persisted and sent to the model, so it stays English and stable —
// changing one would silently reset a user's saved personality. Only the label
// and description are translated, resolved at render time.
const TONES = ['warm', 'direct', 'playful', 'professional', 'dry-wit'] as const;
const ENERGIES = ['calm', 'enthusiastic', 'measured', 'excitable'] as const;
const STYLES = ['concise', 'detailed', 'conversational', 'structured'] as const;

/** Resolve a persona option's translated label + description. */
function optionCopy(group: 'tone' | 'energy' | 'style', value: string) {
  const key = (suffix: string) => `persona.${group}.${value}.${suffix}` as Parameters<typeof t>[0];
  return { value, label: t(key('label')), desc: t(key('desc')) };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PersonalityDesigner() {
  const [tone, setTone] = useState('warm');
  const [energy, setEnergy] = useState('enthusiastic');
  const [style, setStyle] = useState('conversational');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  // Load personality on mount
  useEffect(() => {
    const p = loadPersonality();
    setTone(p.tone);
    setEnergy(p.energy);
    setStyle(p.style);
    setDescription(p.description);
  }, []);

  const handleSave = () => {
    savePersonality({ name: 'Ava', pronouns: 'she/her', tone, energy, style, description });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    const p = resetPersonality();
    setTone(p.tone);
    setEnergy(p.energy);
    setStyle(p.style);
    setDescription(p.description);
  };

  const toneOptions = TONES.map(v => optionCopy('tone', v));
  const energyOptions = ENERGIES.map(v => optionCopy('energy', v));
  const styleOptions = STYLES.map(v => optionCopy('style', v));

  const toneLabel = toneOptions.find(o => o.value === tone)?.label?.toLowerCase() ?? tone;
  const energyLabel = energyOptions.find(o => o.value === energy)?.label?.toLowerCase() ?? energy;
  const styleLabel = styleOptions.find(o => o.value === style)?.label?.toLowerCase() ?? style;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-ava-border">
        <h2 className="font-semibold text-white text-lg">{t('personaTitle')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('personaSubtitle')}</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Tone */}
        <FieldSection label={t('personaTone')}>
          <div className="space-y-2">
            {toneOptions.map(t => (
              <OptionCard
                key={t.value}
                label={t.label}
                description={t.desc}
                selected={tone === t.value}
                onClick={() => setTone(t.value)}
              />
            ))}
          </div>
        </FieldSection>

        {/* Energy */}
        <FieldSection label={t('personaEnergy')}>
          <div className="space-y-2">
            {energyOptions.map(e => (
              <OptionCard
                key={e.value}
                label={e.label}
                description={e.desc}
                selected={energy === e.value}
                onClick={() => setEnergy(e.value)}
              />
            ))}
          </div>
        </FieldSection>

        {/* Communication Style */}
        <FieldSection label={t('personaStyle')}>
          <div className="space-y-2">
            {styleOptions.map(s => (
              <OptionCard
                key={s.value}
                label={s.label}
                description={s.desc}
                selected={style === s.value}
                onClick={() => setStyle(s.value)}
              />
            ))}
          </div>
        </FieldSection>

        {/* Description */}
        <FieldSection label={t('personaDescription')}>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('personaDescPlaceholder')}
            rows={3}
            className="w-full bg-ava-bg border border-ava-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-ava-purple transition resize-none"
          />
          <p className="text-[11px] text-gray-500 mt-1.5">
            {t('personaDescHint')}
          </p>
        </FieldSection>

        {/* Live preview */}
        <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
          <p className="text-[11px] font-bold text-gray-500 tracking-wider mb-2 uppercase">{t('personaPreview')}</p>
          {/* One interpolated sentence rather than concatenated fragments —
              "will be X, Y, and Z" cannot be reordered by a translator when
              it is glued together in JSX, and word order varies by language. */}
          <p className="text-sm text-white">
            {t('personaPreviewLine')
              .replace('{tone}', toneLabel)
              .replace('{energy}', energyLabel)
              .replace('{style}', styleLabel)}
          </p>
          {description && (
            <p className="mt-2 text-xs text-gray-400 italic">
              &ldquo;{description}&rdquo;
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleSave}
            className="w-full rounded-xl border border-ava-purple/25 bg-ava-purple/10 py-2.5 text-sm font-medium text-ava-purple transition hover:bg-ava-purple/20"
          >
            {saved ? t('saved') : t('personaSave')}
          </button>
          <button
            onClick={handleReset}
            className="w-full bg-ava-surface border border-ava-border text-gray-400 font-medium py-2.5 rounded-xl hover:text-white hover:border-gray-500 transition text-sm"
          >
            {t('resetToDefault')}
          </button>
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function FieldSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-gray-500 tracking-wider mb-2">{label}</h3>
      {children}
    </div>
  );
}

function OptionCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full relative flex items-start rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-ava-purple bg-ava-purple/10'
          : 'border-ava-border bg-ava-surface hover:border-gray-500'
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-gray-300'}`}>
          {label}
        </span>
        <span className="block mt-0.5 text-xs text-gray-500 leading-relaxed">
          {description}
        </span>
      </div>
      {selected && (
        <span className="ml-2 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ava-purple">
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
      )}
    </button>
  );
}
