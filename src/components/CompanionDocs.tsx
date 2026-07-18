'use client';

// Companion documentation — renders the canonical core corpus (via the
// generated mirror at @/lib/docs, kept in step by `pnpm docs:sync`) filtered to
// the 'companion' surface. Mobile-first: a search box + sectioned pages, each
// with a "Show me the details" expander and capability badges, exactly like the
// other surfaces but styled for a phone.

import { useMemo, useState, type ReactNode } from 'react';
import {
  type RendererAdapter,
  type FactsData,
  TOOLS, PROVIDERS, MODES, PERSONAS, PERMISSION_MODES, SHORTCUTS,
  filterForSurface, buildSidebar, getPages, renderPage,
} from '@/lib/docs';
import { t, useLocale } from '@/lib/i18n';

const SURFACE_LABELS: Record<string, string> = { ext: 'Extension', ide: 'IDE', companion: 'Companion', cli: 'CLI', web: 'Web' };

let k = 0;
const key = () => `d${k++}`;

function makeAdapter(): RendererAdapter<ReactNode> {
  return {
    paragraph: (text) => <p key={key()} className="text-sm leading-relaxed text-gray-300 mb-3">{text}</p>,
    heading: (level, text) => {
      const cls = level === 2 ? 'text-base font-semibold text-white mt-5 mb-2'
        : level === 3 ? 'text-sm font-semibold text-white mt-4 mb-1.5'
        : 'text-sm font-medium text-gray-200 mt-3 mb-1';
      return <div key={key()} className={cls}>{text}</div>;
    },
    list: (items, ordered) => ordered
      ? <ol key={key()} className="list-decimal pl-5 mb-3 space-y-1 text-sm text-gray-300">{items.map((i) => <li key={key()}>{i}</li>)}</ol>
      : <ul key={key()} className="list-disc pl-5 mb-3 space-y-1 text-sm text-gray-300">{items.map((i) => <li key={key()}>{i}</li>)}</ul>,
    code: (text) => <pre key={key()} className="mb-3 overflow-x-auto rounded-lg bg-black/40 border border-ava-border p-3 text-xs text-gray-200"><code>{text}</code></pre>,
    callout: (text, variant) => {
      const c = variant === 'warning' ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
        : variant === 'tip' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
        : 'border-ava-purple/30 bg-ava-purple/5 text-gray-200';
      return <div key={key()} className={`mb-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${c}`}>{text}</div>;
    },
    link: (text, href, external) => <a key={key()} href={href} target={external ? '_blank' : undefined} rel="noreferrer" className="text-ava-purple-light underline">{text}</a>,
    table: (headers, rows) => (
      <div key={key()} className="mb-3 overflow-x-auto rounded-lg border border-ava-border">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-400">{headers.map((h) => <th key={key()} className="text-left p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={key()} className="border-t border-ava-border">{r.map((c) => <td key={key()} className="p-2 align-top text-gray-300">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    ),
    // Fact tables — compact mobile renderings from the same canonical data.
    tools: (items) => (
      <div key={key()} className="mb-3 space-y-1">
        {items.map((t) => <div key={key()} className="flex items-baseline justify-between gap-3 rounded-md bg-white/5 px-2.5 py-1.5"><span className="font-mono text-[11px] text-white">{t.name}</span><span className="text-[10px] text-gray-400">{t.category}</span></div>)}
      </div>
    ),
    providers: (items) => (
      <div key={key()} className="mb-3 space-y-1.5">
        {items.map((p) => <div key={key()} className="rounded-md bg-white/5 px-2.5 py-1.5"><div className="text-xs font-medium text-white">{p.name}</div>{p.models?.length ? <div className="mt-0.5 text-[10px] text-gray-400">{p.models.join(', ')}</div> : null}</div>)}
      </div>
    ),
    modes: (items) => (
      <div key={key()} className="mb-3 space-y-1.5">
        {items.map((m) => <div key={key()} className="rounded-md bg-white/5 px-2.5 py-2"><div className="flex items-center gap-2"><span className="font-mono text-[11px] text-ava-purple-light">{m.prefix}</span><span className="text-xs font-semibold text-white">{m.displayName}</span></div><div className="mt-0.5 text-[11px] text-gray-400">{m.summary}</div></div>)}
      </div>
    ),
    personas: (items) => (
      <div key={key()} className="mb-3 space-y-1">
        {items.map((p) => <div key={key()} className="rounded-md bg-white/5 px-2.5 py-1.5"><span className="text-xs font-medium text-white">{p.name}</span><span className="ml-2 text-[10px] text-gray-400">{p.mode}</span></div>)}
      </div>
    ),
    permissions: (items) => (
      <div key={key()} className="mb-3 space-y-1.5">
        {items.map((p) => <div key={key()} className="rounded-md bg-white/5 px-2.5 py-2"><div className="text-xs font-semibold text-white">{p.displayName}</div><div className="mt-0.5 text-[11px] text-gray-400">{p.summary}</div></div>)}
      </div>
    ),
    shortcuts: (items) => (
      <div key={key()} className="mb-3 space-y-1">
        {items.map((s) => <div key={key()} className="flex items-baseline justify-between gap-3 rounded-md bg-white/5 px-2.5 py-1.5"><span className="text-[11px] text-gray-300">{s.action}</span><span className="font-mono text-[10px] text-white">{s.keysWin}</span></div>)}
      </div>
    ),
    page: (title, blocks, anchor, extras) => (
      <section key={anchor} id={anchor} className="mb-8 scroll-mt-4">
        <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
        {extras?.badges && extras.badges.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Works on</span>
            {extras.badges.map((s) => <span key={s} className="rounded px-1.5 py-0.5 text-[9px] bg-white/5 text-gray-400">{SURFACE_LABELS[s]}</span>)}
          </div>
        )}
        <div className="border-b border-ava-border mb-3" />
        {blocks}
        {extras?.deeper && extras.deeper.length > 0 && (
          <details className="mt-3 rounded-lg border border-ava-border bg-white/[0.02]">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-ava-purple-light">{t('docsShowDetails')}</summary>
            <div className="px-3 pb-3 pt-1">{extras.deeper}</div>
          </details>
        )}
      </section>
    ),
    document: () => null,
  };
}

export default function CompanionDocs({ onBack, onAsk }: { onBack: () => void; onAsk: (q: string) => void }) {
  const [search, setSearch] = useState('');
  const [ask, setAsk] = useState('');
  const locale = useLocale();
  const submitAsk = () => { const q = ask.trim(); if (q) { onAsk(q); setAsk(''); } };

  const { sections, pagesById } = useMemo(() => {
    const all = filterForSurface(getPages(locale), 'companion');
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter((p) => p.title.toLowerCase().includes(q) || p.body.some((b) => 'text' in b && typeof b.text === 'string' && b.text.toLowerCase().includes(q)))
      : all;
    return { sections: buildSidebar(filtered), pagesById: new Map(filtered.map((p) => [p.id, p])) };
  }, [search, locale]);

  const data: FactsData = { tools: TOOLS, providers: PROVIDERS, modes: MODES, personas: PERSONAS, permissions: PERMISSION_MODES, shortcuts: SHORTCUTS };
  const adapter = makeAdapter();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ava-border shrink-0">
        <button onClick={onBack} aria-label="Back" className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-semibold text-white">{t('docsTitle')}</h1>
      </div>
      <div className="px-4 pt-3 shrink-0 space-y-2">
        {/* Ask Ava — type a question, get a surface-aware answer in chat. */}
        <form onSubmit={(e) => { e.preventDefault(); submitAsk(); }} className="flex gap-2">
          <input
            type="text"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder={t('docsAskPlaceholder')}
            className="flex-1 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-ava-purple"
          />
          {/* House button style — accent tint with a bordered edge, never a
              solid fill. This was `bg-ava-purple text-white`, the one solid
              button left in the companion. */}
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-ava-purple/25 bg-ava-purple/10 px-4 py-2 text-sm font-medium text-ava-purple transition hover:bg-ava-purple/20"
          >
            {t('docsAskButton')}
          </button>
        </form>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('docsSearchPlaceholder')}
          className="w-full rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-ava-purple"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {sections.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">No help articles match “{search}”.</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="mb-8">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">{section.title}</div>
              {section.pages.map((sp) => {
                const page = pagesById.get(sp.id);
                return page ? renderPage(page, adapter, data) : null;
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
