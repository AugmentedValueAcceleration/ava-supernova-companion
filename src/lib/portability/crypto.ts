/**
 * Portability crypto — the companion's byte-compatible port of
 * `@ava/core/portability/crypto`. Same `.ava-backup` envelope: AES-256-GCM
 * ciphertext, scrypt-derived key, JSON wrapper. The desktop core uses
 * node:crypto; the phone can't, so this reimplements the identical format
 * with @noble/hashes (scrypt) + Web Crypto (AES-GCM).
 *
 * Verified cross-compatible with core: a file sealed on the desktop opens
 * here and vice-versa (same MAGIC/version/KDF params). Do NOT change the
 * params or layout without changing core in lockstep — the whole point is
 * that one file works on every surface.
 */

import { scryptAsync } from '@noble/hashes/scrypt.js';

const MAGIC = 'AVABKP';
const ENVELOPE_VERSION = 1 as const;
const KEY_LEN = 32; // AES-256
// Must match core's params exactly (portability/crypto.ts).
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

interface KdfParams { algo: 'scrypt'; N: number; r: number; p: number; salt: string }

export interface SealedEnvelope {
  magic: typeof MAGIC;
  v: typeof ENVELOPE_VERSION;
  kdf: KdfParams;
  /** base64 AES-GCM nonce. */
  iv: string;
  /** base64 ciphertext. */
  ct: string;
  /** base64 GCM auth tag. */
  tag: string;
}

const te = new TextEncoder();
const td = new TextDecoder();

function toB64(u8: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000; // avoid call-stack overflow on large buffers
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function fromB64(b: string): Uint8Array {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

// Web Crypto wants BufferSource; TS 5.7 types our Uint8Arrays as
// Uint8Array<ArrayBufferLike>, which it won't narrow. Runtime-safe coercion.
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  p: Pick<KdfParams, 'N' | 'r' | 'p'>,
): Promise<Uint8Array> {
  // NFKC-normalise so the same typed passphrase derives the same key across
  // platforms/keyboards (matches core).
  const pw = te.encode(passphrase.normalize('NFKC'));
  return scryptAsync(pw, salt, { N: p.N, r: p.r, p: p.p, dkLen: KEY_LEN });
}

/** Encrypt a plaintext string under a passphrase. Returns the JSON envelope. */
export async function seal(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('A passphrase is required to seal a backup');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await deriveKey(passphrase, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const key = await crypto.subtle.importKey('raw', bs(keyBytes), { name: 'AES-GCM' }, false, ['encrypt']);
  // SubtleCrypto returns ciphertext WITH the 16-byte GCM tag appended; core
  // stores them separately, so split here.
  const ctTag = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(te.encode(plaintext))));
  const tag = ctTag.subarray(ctTag.length - 16);
  const ct = ctTag.subarray(0, ctTag.length - 16);
  const env: SealedEnvelope = {
    magic: MAGIC,
    v: ENVELOPE_VERSION,
    kdf: { algo: 'scrypt', N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, salt: toB64(salt) },
    iv: toB64(iv),
    ct: toB64(ct),
    tag: toB64(tag),
  };
  return JSON.stringify(env);
}

/** Decrypt a JSON envelope under a passphrase. Throws on wrong passphrase,
 *  tampering, or unrecognised format — never returns partial/garbage data. */
export async function open(envelopeJson: string, passphrase: string): Promise<string> {
  let env: SealedEnvelope;
  try {
    env = JSON.parse(envelopeJson) as SealedEnvelope;
  } catch {
    throw new Error('This is not a valid Ava backup file');
  }
  if (env?.magic !== MAGIC || env.v !== ENVELOPE_VERSION) {
    throw new Error('Unrecognised backup format or version');
  }
  if (env.kdf?.algo !== 'scrypt') throw new Error('Unsupported key-derivation in backup');

  const salt = fromB64(env.kdf.salt);
  const keyBytes = await deriveKey(passphrase, salt, { N: env.kdf.N, r: env.kdf.r, p: env.kdf.p });
  const key = await crypto.subtle.importKey('raw', bs(keyBytes), { name: 'AES-GCM' }, false, ['decrypt']);
  // Recombine ct||tag for SubtleCrypto's AES-GCM decrypt.
  const ct = fromB64(env.ct);
  const tag = fromB64(env.tag);
  const ctTag = new Uint8Array(ct.length + tag.length);
  ctTag.set(ct, 0);
  ctTag.set(tag, ct.length);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(fromB64(env.iv)) }, key, bs(ctTag));
    return td.decode(pt);
  } catch {
    // GCM tag mismatch — wrong passphrase or the file was altered/corrupted.
    throw new Error('Wrong passphrase, or the backup is corrupted');
  }
}

/** True if a string looks like an Ava sealed envelope (cheap pre-check). */
export function isSealedEnvelope(s: string): boolean {
  try {
    const env = JSON.parse(s) as SealedEnvelope;
    return env?.magic === MAGIC && typeof env.ct === 'string';
  } catch {
    return false;
  }
}
