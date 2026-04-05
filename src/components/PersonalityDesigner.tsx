'use client';

import { useState, useEffect } from 'react';
import { loadPersonality, savePersonality, resetPersonality } from '@/lib/personality';
import { t } from '@/lib/i18n';

// ── Option descriptors ─────────────────────────────────────────────────────

const TONES = [
  { value: 'warm', label: 'Warm', desc: 'Warm and encouraging' },
  { value: 'direct', label: 'Direct', desc: 'Direct and no-nonsense' },
  { value: 'playful', label: 'Playful', desc: 'Playful and witty' },
  { value: 'professional', label: 'Professional', desc: 'Professional and polished' },
  { value: 'dry-wit', label: 'Dry Wit', desc: 'Dry wit — understated brilliance' },
];

const ENERGIES = [
  { value: 'calm', label: 'Calm', desc: 'Calm and steady' },
  { value: 'enthusiastic', label: 'Enthusiastic', desc: 'Enthusiastic and excited' },
  { value: 'measured', label: 'Measured', desc: 'Measured and deliberate' },
  { value: 'excitable', label: 'Excitable', desc: 'High energy and expressive' },
];

const STYLES = [
  { value: 'concise', label: 'Concise', desc: 'Sharp, no filler' },
  { value: 'detailed', label: 'Detailed', desc: 'Thorough, explains the why' },
  { value: 'conversational', label: 'Conversational', desc: 'Natural, talks like a person' },
  { value: 'structured', label: 'Structured', desc: 'Headers, bullets, organised' },
];

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

  const toneLabel = TONES.find(t => t.value === tone)?.label?.toLowerCase() ?? tone;
  const energyLabel = ENERGIES.find(e => e.value === energy)?.label?.toLowerCase() ?? energy;
  const styleLabel = STYLES.find(s => s.value === style)?.label?.toLowerCase() ?? style;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-ava-border">
        <h2 className="font-semibold text-white text-lg">Tune Ava&apos;s Style</h2>
        <p className="text-xs text-gray-500 mt-0.5">Adjust how Ava communicates with you</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Tone */}
        <FieldSection label="TONE">
          <div className="space-y-2">
            {TONES.map(t => (
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
        <FieldSection label="ENERGY">
          <div className="space-y-2">
            {ENERGIES.map(e => (
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
        <FieldSection label="COMMUNICATION STYLE">
          <div className="space-y-2">
            {STYLES.map(s => (
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
        <FieldSection label="DESCRIPTION">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Like a patient older brother who's been coding for 20 years"
            rows={3}
            className="w-full bg-ava-bg border border-ava-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-ava-purple transition resize-none"
          />
          <p className="text-[11px] text-gray-500 mt-1.5">
            Optional. Describe the vibe in your own words and your AI will embody it.
          </p>
        </FieldSection>

        {/* Live preview */}
        <div className="bg-ava-surface border border-ava-border rounded-xl p-4">
          <p className="text-[11px] font-bold text-gray-500 tracking-wider mb-2">PREVIEW</p>
          <p className="text-sm text-white">
            <span className="font-semibold text-ava-purple">Ava</span>{' '}
            will be {toneLabel}, {energyLabel}, and {styleLabel}.
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
            className="w-full bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2.5 rounded-xl transition text-sm"
          >
            {saved ? t('saved') : 'Save Personality'}
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
