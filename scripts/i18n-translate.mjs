#!/usr/bin/env node
/**
 * Auto-translate untranslated i18n strings via Qwen (platform or direct).
 *
 * Fills every key whose non-en value equals the en value AND is NOT in
 * KEEP_ENGLISH. Safe to re-run — idempotent.
 *
 * Usage:
 *   npm run i18n:translate                      # all locales
 *   npm run i18n:translate -- --dry-run         # show plan, don't write
 *   npm run i18n:translate -- --locales=es,fr
 *
 * Credentials resolved in this order:
 *   1. --api-key=<...>
 *   2. $AVA_PLATFORM_KEY / $QWEN_API_KEY
 *   3. ~/.ava/config.json -> platformKey or providers.qwen.apiKey
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(repoRoot, 'src/locales');
const keepEnglishFile = path.join(localesDir, 'keep-english.ts');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const eq = a.indexOf('=');
    if (a.startsWith('--') && eq > 0) return [a.slice(2, eq), a.slice(eq + 1)];
    if (a.startsWith('--')) return [a.slice(2), 'true'];
    return [a, 'true'];
  })
);

const DRY_RUN = args['dry-run'] === 'true';
const LOCALE_FILTER = args.locales ? new Set(args.locales.split(',')) : null;
const MODEL = args.model || 'qwen3.5-flash';
const BATCH_SIZE = Number(args['batch-size'] || 40);
const CRED = resolveCredential();

if (!CRED && !DRY_RUN) {
  console.error('❌ No credential found.');
  console.error('   Set AVA_PLATFORM_KEY (or QWEN_API_KEY) or add platformKey to ~/.ava/config.json.');
  process.exit(1);
}

const COMPLETION_URL = args['base-url']
  ? `${args['base-url'].replace(/\/$/, '')}/chat/completions`
  : (CRED?.kind === 'platform'
      ? 'https://ava-supernova.com/api/chat'
      : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');

function resolveCredential() {
  const classify = (raw) => raw
    ? { kind: raw.startsWith('sk-ava-') ? 'platform' : 'qwen', key: raw }
    : null;
  if (args['api-key']) return classify(args['api-key']);
  if (process.env.AVA_PLATFORM_KEY) return { kind: 'platform', key: process.env.AVA_PLATFORM_KEY };
  if (process.env.QWEN_API_KEY) return { kind: 'qwen', key: process.env.QWEN_API_KEY };
  try {
    const cfgPath = path.join(os.homedir(), '.ava', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg?.platformKey) return { kind: 'platform', key: cfg.platformKey };
      if (cfg?.providers?.qwen?.apiKey) return { kind: 'qwen', key: cfg.providers.qwen.apiKey };
    }
  } catch { /* ignore */ }
  return null;
}

const LANGUAGE_NAMES = {
  'en': 'English',
  'zh-CN': 'Simplified Chinese (中文简体)',
  'zh-TW': 'Traditional Chinese (中文繁體)',
  'ja': 'Japanese (日本語)', 'ko': 'Korean (한국어)',
  'es': 'Spanish (Español)', 'pt': 'Portuguese (Português)',
  'fr': 'French (Français)', 'de': 'German (Deutsch)',
  'ru': 'Russian (Русский)', 'ar': 'Arabic (العربية)',
  'hi': 'Hindi (हिन्दी)', 'vi': 'Vietnamese (Tiếng Việt)',
  'th': 'Thai (ไทย)', 'tr': 'Turkish (Türkçe)',
  'it': 'Italian (Italiano)', 'pl': 'Polish (Polski)',
  'uk': 'Ukrainian (Українська)', 'nl': 'Dutch (Nederlands)',
  'id': 'Indonesian (Bahasa Indonesia)',
};

const DO_NOT_TRANSLATE = [
  'Ava', 'Supernova', 'Ava Supernova', 'JARVIS',
  'Qwen', 'DeepSeek', 'Kimi', 'Mistral', 'MiniMax', 'Anthropic', 'Claude',
  'GitHub', 'Slack', 'Discord', 'Git',
  'IDE', 'CLI', 'API', 'URL', 'HTTP', 'HTTPS', 'JSON', 'YAML', 'SQL',
  'Pro', 'Ultra', 'Enterprise', 'Admin', 'Free',
];

const tsPat = /^\s*(['"])([^'"]+)\1\s*:\s*(['"`])((?:\\[\s\S]|(?!\3)[\s\S])*)\3/gm;

function parseTs(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const map = {};
  for (const m of text.matchAll(tsPat)) {
    try { map[m[2]] = new Function('return "' + m[4].replace(/"/g, '\\"') + '"')(); }
    catch { map[m[2]] = m[4]; }
  }
  return map;
}

function parseKeepEnglish(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const text = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  const setMatch = text.match(/new Set<\s*StringKey\s*>\(\s*\[([\s\S]*?)\]/);
  if (!setMatch) return keys;
  for (const m of setMatch[1].matchAll(/['"]([^'"]+)['"]/g)) keys.add(m[1]);
  return keys;
}

function escapeTs(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function replaceTsValue(text, key, newValue) {
  const keyPat = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^\\s*['"]${keyPat}['"]\\s*:\\s*)(['"\`])((?:\\\\[\\s\\S]|(?!\\2)[\\s\\S])*)\\2`, 'm');
  return text.replace(re, `$1'${escapeTs(newValue)}'`);
}

function buildSystemPrompt(targetLanguage, glossary) {
  return [
    `You are a professional UI-string translator for Ava Supernova's companion app (a mobile PWA + Capacitor wrap).`,
    `Translate the provided strings from English into ${targetLanguage}.`,
    ``,
    `Rules:`,
    `1. Return ONLY a single JSON object. Format: {"key": "translation", ...}`,
    `2. JSON MUST contain exactly the same keys as the input.`,
    `3. Preserve placeholders like {name}, {count}.`,
    `4. Preserve inline markdown (**bold**, \`code\`) and escape sequences.`,
    `5. Translate every string by default. Short single-word UI labels (Chat, Plan, Memory, Error, Settings) MUST be translated.`,
    `6. Do NOT translate ONLY these exact tokens: ${glossary.join(', ')}.`,
    `7. Prefer natural, idiomatic ${targetLanguage}.`,
  ].join('\n');
}

async function translateBatch({ targetLanguage, entries, attempt = 1 }) {
  const systemPrompt = buildSystemPrompt(targetLanguage, DO_NOT_TRANSLATE);
  const userPayload = JSON.stringify(Object.fromEntries(entries), null, 2);
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Translate these UI strings to ${targetLanguage}:\n\n${userPayload}` },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  let res;
  try {
    res = await fetch(COMPLETION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRED.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' && attempt < 3) {
      console.log(`    retry ${attempt}/3 after 5000ms (timeout)`);
      await new Promise((r) => setTimeout(r, 5000));
      return translateBatch({ targetLanguage, entries, attempt: attempt + 1 });
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      const delay = 2 ** attempt * 1000;
      console.log(`    retry ${attempt}/3 after ${delay}ms (status ${res.status})`);
      await new Promise((r) => setTimeout(r, delay));
      return translateBatch({ targetLanguage, entries, attempt: attempt + 1 });
    }
    throw new Error(`Qwen API ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
  return JSON.parse(cleaned);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

(async () => {
  console.log(`companion i18n-translate — model=${MODEL}${DRY_RUN ? ' (dry-run)' : ''}`);
  if (CRED) console.log(`  auth: ${CRED.kind} → ${COMPLETION_URL}`);
  if (LOCALE_FILTER) console.log(`  locales: ${[...LOCALE_FILTER].join(', ')}`);

  const en = parseTs(path.join(localesDir, 'en.ts'));
  const keep = parseKeepEnglish(keepEnglishFile);

  const files = fs.readdirSync(localesDir).filter(f =>
    f.endsWith('.ts') && f !== 'en.ts' && f !== 'keep-english.ts');

  let total = 0;
  for (const f of files) {
    const locale = f.replace(/\.ts$/, '');
    if (LOCALE_FILTER && !LOCALE_FILTER.has(locale)) continue;
    const filePath = path.join(localesDir, f);
    const other = parseTs(filePath);
    const entries = [];
    for (const [k, v] of Object.entries(other)) {
      if (!(k in en)) continue;
      if (keep.has(k)) continue;
      if (v === en[k]) entries.push([k, en[k]]);
    }
    if (entries.length === 0) {
      console.log(`\n  [${locale}] already complete.`);
      continue;
    }
    const targetLanguage = LANGUAGE_NAMES[locale] || locale;
    console.log(`\n  [${locale}] ${entries.length} strings to ${targetLanguage}`);

    const translations = {};
    const batches = chunkArray(entries, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      process.stdout.write(`    batch ${i + 1}/${batches.length} (${batch.length}) ... `);
      if (DRY_RUN) { console.log('dry-run'); continue; }
      try {
        const result = await translateBatch({ targetLanguage, entries: batch });
        let added = 0;
        for (const [k, v] of batch) {
          const t = result[k];
          if (typeof t === 'string' && t.length > 0 && t !== v) {
            translations[k] = t;
            added++;
          }
        }
        console.log(`ok (${added} accepted)`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
    }

    if (DRY_RUN) continue;
    if (Object.keys(translations).length === 0) {
      console.log(`    no accepted — leaving ${f} unchanged.`);
      continue;
    }
    let text = fs.readFileSync(filePath, 'utf8');
    for (const [k, v] of Object.entries(translations)) text = replaceTsValue(text, k, v);
    fs.writeFileSync(filePath, text, 'utf8');
    total += Object.keys(translations).length;
    console.log(`    wrote ${Object.keys(translations).length} translations to ${f}`);
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Done. Translated ${total} strings.`);
  console.log(`Run \`npm run i18n:check\` to verify.`);
})();
