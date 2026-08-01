'use client';

import { useState, useEffect } from 'react';
import { Markdown } from './Markdown';
import { t } from '@/lib/i18n';

interface Release {
  version: string;
  title: string;
  body: string;
  highlights?: string[];
  date?: string;
  platform?: string;
}

const PLAT_COLOURS: Record<string, string> = { core: '#89b4fa', extension: '#a855f7', ide: '#a6e3a1', companion: '#fab387' };
const PLAT_LABELS: Record<string, string> = { core: 'Core', extension: 'Extension', ide: 'IDE', companion: 'Companion' };

export default function ReleaseNotes({ onBack }: { onBack: () => void }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformTab, setPlatformTab] = useState('all');

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        const res = await fetch('https://avasupernova.com/api/releases');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setReleases(data.releases || data || []);
      } catch {
        setError('Could not load release notes. Check your connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchReleases();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-ava-border flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-white text-lg">{t('releaseNotes')}</h2>
      </div>

      {/* Platform tabs */}
      <div className="px-4 pt-3 flex gap-1 flex-wrap">
        {['all', 'core', 'extension', 'ide', 'companion'].map(tab => (
          <button
            key={tab}
            onClick={() => setPlatformTab(tab)}
            className="px-3 py-1 rounded-full text-[11px] font-semibold transition"
            style={{
              background: platformTab === tab ? (tab === 'all' ? '#a855f7' : PLAT_COLOURS[tab]) : '#1e1e2e',
              color: platformTab === tab ? (tab === 'core' || tab === 'extension' ? '#fff' : '#11111b') : '#6c7086',
            }}
          >
            {tab === 'all' ? 'All' : PLAT_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : error ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">{error}</p>
          </div>
        ) : releases.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No release notes available</p>
          </div>
        ) : (
          releases.filter(r => platformTab === 'all' || (r.platform || 'extension') === platformTab).map(release => (
            <div key={release.version} className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{release.title || `v${release.version}`}</span>
                  <span className="text-[10px] font-bold text-ava-purple-light bg-ava-purple-dark/40 px-1.5 py-0.5 rounded">
                    v{release.version}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{
                      color: PLAT_COLOURS[release.platform || 'extension'],
                      background: `${PLAT_COLOURS[release.platform || 'extension']}20`,
                    }}
                  >
                    {PLAT_LABELS[release.platform || 'extension']}
                  </span>
                </div>
                {release.date && (
                  <span className="text-[11px] text-gray-500">
                    {new Date(release.date).toLocaleDateString()}
                  </span>
                )}
              </div>

              {release.highlights && release.highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {release.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-medium text-ava-purple-light bg-ava-purple/20 px-2 py-0.5 rounded-full"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}

              {release.body && (
                <div className="text-sm text-gray-300 leading-relaxed">
                  <Markdown content={release.body} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
