/**
 * Companion data portability — export/import the same `.ava-backup` the
 * IDE and extension use, so a user can move data between their devices
 * without the cloud. Mirrors `@ava/core/portability` (the desktop code is
 * Node-only; this is the verified byte-compatible web port).
 */

import { seal, open, isSealedEnvelope, type SealedEnvelope } from './crypto';
import {
  gatherBundle,
  restoreBundle,
  localStorageKV,
  BUNDLE_VERSION,
  type DataBundle,
  type RestoreResult,
  type KV,
} from './bundle';

export { seal, open, isSealedEnvelope, type SealedEnvelope };
export {
  gatherBundle,
  restoreBundle,
  localStorageKV,
  BUNDLE_VERSION,
  type DataBundle,
  type RestoreResult,
  type KV,
};

/** Encrypted export → the string to write to a `.ava-backup` file. */
export async function exportEncryptedBackup(passphrase: string, kv: KV = localStorageKV()): Promise<string> {
  const bundle = gatherBundle(kv, 'companion');
  return seal(JSON.stringify(bundle), passphrase);
}

/** Readable (unencrypted) export → pretty JSON to write to a `.json` file. */
export function exportReadableBundle(kv: KV = localStorageKV()): string {
  return JSON.stringify(gatherBundle(kv, 'companion'), null, 2);
}

/**
 * Import a backup file. Auto-detects encrypted (`.ava-backup`) vs readable
 * (`.json`) by sniffing the envelope. Encrypted files need the passphrase.
 * Safe-merge by default; pass `overwrite` to replace existing entries.
 */
export async function importBackup(
  fileContent: string,
  opts?: { passphrase?: string; overwrite?: boolean; kv?: KV },
): Promise<{ bundle: DataBundle; result: RestoreResult }> {
  const kv = opts?.kv ?? localStorageKV();
  let json: string;
  if (isSealedEnvelope(fileContent)) {
    if (!opts?.passphrase) throw new Error('This backup is encrypted — enter its passphrase to import it.');
    json = await open(fileContent, opts.passphrase);
  } else {
    json = fileContent;
  }
  let bundle: DataBundle;
  try {
    bundle = JSON.parse(json) as DataBundle;
  } catch {
    throw new Error('This file is not a readable Ava backup.');
  }
  if (bundle?.v !== BUNDLE_VERSION || typeof bundle.files !== 'object') {
    throw new Error('This file is not a recognised Ava backup.');
  }
  const result = restoreBundle(kv, bundle, { overwrite: opts?.overwrite });
  return { bundle, result };
}
