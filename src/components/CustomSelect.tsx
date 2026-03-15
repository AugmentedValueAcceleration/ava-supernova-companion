'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || highlightIdx < 0) return;
    const item = listRef.current?.children[highlightIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
    const idx = options.findIndex((o) => o.value === value);
    setHighlightIdx(idx >= 0 ? idx : 0);
  }, [options, value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < options.length && !options[highlightIdx].disabled) {
          onChange(options[highlightIdx].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ava-border bg-ava-surface px-3 py-2 text-left text-sm text-white outline-none transition focus:border-ava-purple"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${selected.badgeColor || 'text-gray-400 bg-gray-400/10'}`}>
              {selected.badge}
            </span>
          )}
          <span className={`truncate ${selected ? 'text-white' : 'text-gray-500'}`}>
            {selected ? selected.label : placeholder || 'Select...'}
          </span>
          {selected?.sublabel && (
            <span className="text-gray-500 text-xs truncate">{selected.sublabel}</span>
          )}
        </div>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          onKeyDown={handleKeyDown}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ava-border bg-ava-bg shadow-xl"
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightIdx(i)}
              disabled={opt.disabled}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                opt.disabled ? 'opacity-40 cursor-not-allowed' :
                i === highlightIdx ? 'bg-ava-surface text-white' :
                'text-gray-400 hover:bg-ava-surface hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  className={`h-3 w-3 shrink-0 ${opt.value === value ? 'text-ava-purple' : 'text-transparent'}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-white truncate">{opt.label}</span>
                {opt.sublabel && <span className="text-gray-500 text-xs">{opt.sublabel}</span>}
              </div>
              {opt.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${opt.badgeColor || 'text-gray-400 bg-gray-400/10'}`}>
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
