'use client';

// Themed date field — the companion's port of the extension/IDE MiniDatePicker,
// so date pickers across every surface share one dark, on-brand calendar
// instead of the native (light, OS-styled) browser date input. Year nav («»)
// makes far-back dates such as a date of birth reachable without stepping
// month by month. Drop-in replacement for <input type="date">.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MiniDatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDay = new Date(view.y, view.m, 1).getDay();
  const label = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const step = (delta: number) => setView(v => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const stepYear = (delta: number) => setView(v => ({ y: v.y + delta, m: v.m }));

  const navCls = 'text-gray-500 hover:text-white leading-none cursor-pointer';

  return (
    <div className="w-56 p-3 rounded-xl border border-ava-purple/20 bg-ava-bg shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => stepYear(-1)} title="Previous year" className={`${navCls} text-[13px]`}>{'«'}</button>
          <button type="button" onClick={() => step(-1)} title="Previous month" className={`${navCls} text-[11px]`}>{'‹'}</button>
        </span>
        <span className="text-[11px] font-medium text-gray-300">{label}</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => step(1)} title="Next month" className={`${navCls} text-[11px]`}>{'›'}</button>
          <button type="button" onClick={() => stepYear(1)} title="Next year" className={`${navCls} text-[13px]`}>{'»'}</button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DOW.map((d, i) => <span key={i} className="text-[9px] text-gray-500">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {days.map(day => {
          const iso = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = iso === todayStr;
          const isSelected = iso === value;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onChange(iso)}
              className={`w-6 h-6 mx-auto rounded-full text-[11px] flex items-center justify-center transition ${
                isSelected ? 'bg-ava-purple text-white' : isToday ? 'bg-ava-purple/20 text-ava-purple' : 'text-gray-300 hover:bg-ava-surface'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Approx panel size — used to decide whether to flip the calendar above the
// field when there isn't room below (and to keep it on-screen near the edge).
const CAL_WIDTH = 224;
const CAL_DESIRED_HEIGHT = 300;

export function DateField({
  value,
  onChange,
  placeholder = '—',
  className = '',
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const calRef = useRef<HTMLDivElement>(null);
  const [calStyle, setCalStyle] = useState<React.CSSProperties>({});

  const reposition = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < CAL_DESIRED_HEIGHT && rect.top > spaceBelow;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - CAL_WIDTH - 8));
    setCalStyle({
      position: 'fixed',
      left,
      zIndex: 1000,
      ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrap.current?.contains(target)) return;
      if (calRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScrollResize = () => reposition();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScrollResize, true); // capture: catch scrolls on any ancestor
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, reposition]);

  const pretty = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder;

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={value ? 'text-white' : 'text-gray-500'}>{pretty}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {open && createPortal(
        <div ref={calRef} style={calStyle}>
          <MiniDatePicker value={value ?? ''} onChange={(iso) => { onChange(iso || null); setOpen(false); }} />
        </div>,
        document.body,
      )}
    </div>
  );
}
