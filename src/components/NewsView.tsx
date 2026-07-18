'use client';

// News desk — the companion's window onto the same published articles the web
// /news page serves. A category-filtered list plus an in-app reader that shows
// Ava's read alongside the story and lets you carry it straight into chat.
//
// Read-only + public: no auth, no writes, nothing stored locally. It only ever
// GETs from /api/news, so it stays clean under the local-first contract.

import { useCallback, useEffect, useState } from 'react';
import { newsApi } from '@/lib/api';
import { Markdown } from './Markdown';

// Mirrors packages/web/src/lib/news-categories.ts (id + label + icon). Kept
// local because the companion is a separate package; the id list MUST stay in
// step with that canonical source.
const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'world',            label: 'World',      icon: '🌍' },
  { id: 'ai',               label: 'AI',         icon: '🤖' },
  { id: 'technology',       label: 'Technology', icon: '💻' },
  { id: 'open-source',      label: 'Open Source',icon: '📦' },
  { id: 'security-privacy', label: 'Security',   icon: '🛡️' },
  { id: 'business',         label: 'Business',   icon: '📈' },
  { id: 'science',          label: 'Science',    icon: '🔬' },
  { id: 'health',           label: 'Health',     icon: '🩺' },
  { id: 'food',             label: 'Food',       icon: '🍳' },
  { id: 'education',        label: 'Education',   icon: '🎓' },
  { id: 'sport',            label: 'Sport',      icon: '⚽' },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
  source_publication?: string | null;
  ai_generated?: boolean | null;
  image_url?: string | null;
  reading_time?: number | null;
  created_at?: string | null;
}
interface FullPost extends NewsPost {
  content?: string | null;
  ava_commentary?: string | null;
  source_url?: string | null;
  source_author?: string | null;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NewsView({ onAsk }: { onAsk?: (q: string) => void }) {
  const [category, setCategory] = useState<string | null>(null);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader state — when set, we show the full article instead of the list.
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [article, setArticle] = useState<FullPost | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);

  const loadList = useCallback(() => {
    setLoading(true);
    setError(null);
    newsApi.list({ category, limit: 30 })
      .then((data) => setPosts(Array.isArray(data?.posts) ? data.posts : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the news.'))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!openSlug) { setArticle(null); return; }
    setArticleLoading(true);
    setArticleError(null);
    newsApi.article(openSlug)
      .then((data) => setArticle(data?.post ?? null))
      .catch((e) => setArticleError(e instanceof Error ? e.message : 'Could not open this story.'))
      .finally(() => setArticleLoading(false));
  }, [openSlug]);

  // ── Reader ────────────────────────────────────────────────────────────────
  if (openSlug) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ava-border shrink-0">
          <button onClick={() => setOpenSlug(null)} aria-label="Back to news" className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-white truncate">News</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {articleLoading && (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ava-purple/30 border-t-ava-purple" />
            </div>
          )}
          {articleError && (
            <div className="mx-4 my-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{articleError}</div>
          )}
          {article && !articleLoading && (
            <article className="px-4 py-4">
              {article.image_url && (
                <img src={article.image_url} alt="" className="mb-4 w-full rounded-xl border border-ava-border object-cover" style={{ maxHeight: 220 }} />
              )}
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                {article.category && (
                  <span className="rounded-full border border-ava-purple/25 bg-ava-purple/10 px-2 py-0.5 text-ava-purple-light">{CAT_LABEL[article.category] || article.category}</span>
                )}
                {article.reading_time ? <span>{article.reading_time} min read</span> : null}
                <span>{timeAgo(article.created_at)}</span>
              </div>
              <h2 className="mb-3 text-xl font-bold leading-snug text-white">{article.title}</h2>

              {article.ava_commentary && (
                <div className="mb-4 rounded-xl border border-ava-purple/25 bg-ava-purple/[0.07] px-3.5 py-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ava-purple-light">Ava&rsquo;s read</div>
                  <Markdown content={article.ava_commentary} className="text-sm leading-relaxed text-gray-200" />
                </div>
              )}

              {article.content && <Markdown content={article.content} className="text-sm leading-relaxed text-gray-300" />}

              {(article.source_url || article.source_publication || article.source_author) && (
                <div className="mt-5 border-t border-ava-border pt-3 text-[11px] text-gray-500">
                  Source:{' '}
                  {article.source_url ? (
                    <a href={article.source_url} target="_blank" rel="noreferrer" className="text-ava-purple-light underline">
                      {article.source_publication || article.source_author || 'original article'}
                    </a>
                  ) : (
                    <span>{article.source_publication || article.source_author}</span>
                  )}
                  {article.ai_generated ? <span className="ml-1">· summarised by Ava</span> : null}
                </div>
              )}

              {onAsk && (
                <button
                  onClick={() => onAsk(`Tell me more about this news story: "${article.title}". What's your read on it?`)}
                  className="mt-5 w-full rounded-lg border border-ava-purple/25 bg-ava-purple/10 px-4 py-2.5 text-sm font-medium text-ava-purple-light transition hover:bg-ava-purple/20"
                >
                  Ask Ava about this
                </button>
              )}
            </article>
          )}
        </div>
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ava-border shrink-0">
        <h1 className="text-lg font-semibold text-white">News</h1>
        <span className="text-[11px] text-gray-500">Ava&rsquo;s desk</span>
      </div>

      {/* Category filter — horizontal scroll of accent-tint chips. */}
      <div className="shrink-0 overflow-x-auto border-b border-ava-border px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1.5">
          {[{ id: null as string | null, label: 'All', icon: '✦' }, ...CATEGORIES].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id ?? 'all'}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-ava-purple/25 bg-ava-purple/15 text-ava-purple-light'
                    : 'border-ava-border bg-ava-surface text-gray-400 hover:text-white'
                }`}
              >
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ava-purple/30 border-t-ava-purple" />
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            <button onClick={loadList} className="mt-2 block text-xs text-ava-purple-light underline">Try again</button>
          </div>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-500">No stories here yet. Check back soon.</p>
        )}
        {!loading && !error && posts.length > 0 && (
          // Same 2-column image-card grid as the recipes/exercises catalogue
          // (CardShell): aspect-[4/3] image with ✦ fallback, title + a muted
          // "Category · time" meta line.
          <div className="grid grid-cols-2 gap-3">
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenSlug(p.slug)}
                className="text-left h-full active:scale-[0.98] transition"
              >
                <div className="rounded-2xl border border-ava-border bg-ava-surface overflow-hidden h-full">
                  <div className="aspect-[4/3] bg-black/30 flex items-center justify-center">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <span className="text-ava-purple-light/40 text-2xl">✦</span>}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[13px] text-white leading-tight line-clamp-2">{p.title}</div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {[p.category ? (CAT_LABEL[p.category] || p.category) : null, timeAgo(p.created_at)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
