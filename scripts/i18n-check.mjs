#!/usr/bin/env node
/**
 * i18n parity + quality check for the companion (single surface).
 *
 * Fails (exit 1) on:
 *   - Missing keys in any non-en locale vs en baseline
 *   - Extra keys in any non-en locale not present in en
 *   - Non-en value identical to en value, key NOT in KEEP_ENGLISH
 *   - Placeholder mismatch: en uses {x} but locale value drops or changes it
 *
 * Run: `npm run i18n:check`
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(repoRoot, 'src/locales');
const enFile = 'en.ts';
const keepEnglishFile = path.join(localesDir, 'keep-english.ts');

const tsPat = /^\s*(['"])([^'"]+)\1\s*:\s*(['"`])((?:\\[\s\S]|(?!\3)[\s\S])*)\3/gm;

function parseTs(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const map = {};
  for (const m of text.matchAll(tsPat)) {
    try {
      map[m[2]] = new Function('return "' + m[4].replace(/"/g, '\\"') + '"')();
    } catch {
      map[m[2]] = m[4];
    }
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

const placeholderPat = /\{(\w+)\}/g;
function placeholders(s) {
  const set = new Set();
  if (typeof s !== 'string') return set;
  for (const m of s.matchAll(placeholderPat)) set.add(m[1]);
  return set;
}

const args = new Set(process.argv.slice(2));
const summaryOnly = args.has('--summary');

const en = parseTs(path.join(localesDir, enFile));
const enKeys = new Set(Object.keys(en));
const keepEnglish = parseKeepEnglish(keepEnglishFile);

const files = fs.readdirSync(localesDir).filter(f =>
  f.endsWith('.ts') && f !== enFile && f !== 'keep-english.ts');

const errors = [];
const warnings = [];

for (const f of files) {
  const locale = f.replace(/\.ts$/, '');
  const other = parseTs(path.join(localesDir, f));
  const otherKeys = new Set(Object.keys(other));

  for (const k of enKeys) {
    if (!otherKeys.has(k)) errors.push(`[${locale}] MISSING: ${k}`);
  }
  for (const k of otherKeys) {
    if (!enKeys.has(k)) errors.push(`[${locale}] EXTRA (not in en): ${k}`);
  }
  for (const k of otherKeys) {
    if (!enKeys.has(k)) continue;
    const enVal = en[k];
    const otherVal = other[k];

    if (typeof otherVal === 'string' && otherVal.trim() === '') {
      errors.push(`[${locale}] EMPTY: ${k}`);
      continue;
    }
    if (otherVal === enVal && !keepEnglish.has(k)) {
      errors.push(`[${locale}] UNTRANSLATED: ${k} = ${String(enVal).slice(0, 80)}`);
    }
    const enPh = placeholders(enVal);
    const otherPh = placeholders(otherVal);
    for (const p of enPh) {
      if (!otherPh.has(p)) errors.push(`[${locale}] MISSING PLACEHOLDER {${p}} in ${k}`);
    }
    for (const p of otherPh) {
      if (!enPh.has(p)) warnings.push(`[${locale}] EXTRA PLACEHOLDER {${p}} in ${k}`);
    }
  }
}

if (!summaryOnly) {
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

console.log(`\n=== companion i18n check ===`);
console.log(`  locales checked: ${files.length} (+ en baseline)`);
console.log(`  total keys: ${enKeys.size}`);
console.log(`  errors:   ${errors.length}`);
console.log(`  warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log(`\n❌ Fix errors above or add keys to src/locales/keep-english.ts if intentional.`);
  process.exit(1);
}
console.log(`\n✅ i18n check passed.`);
