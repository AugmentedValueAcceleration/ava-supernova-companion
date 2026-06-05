'use client';

import { useRef, useState } from 'react';
import {
  exportEncryptedBackup,
  exportReadableBundle,
  importBackup,
  isSealedEnvelope,
} from '@/lib/portability';

// Backup & Transfer — the companion's side of the shared .ava-backup format.
// Same file the IDE and extension make, so data moves between your devices
// without the cloud. (Strings are English-only for now — i18n is a follow-up.)
export default function PortabilitySection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // passModal: 'export' asks for a passphrase to seal; 'import' holds the
  // encrypted file contents until the user supplies the passphrase to open it.
  const [passModal, setPassModal] = useState<null | { mode: 'export' | 'import'; content?: string }>(null);
  const [pass, setPass] = useState('');

  const today = () => new Date().toISOString().slice(0, 10);

  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function flash(kind: 'ok' | 'err', text: string) {
    setStatus({ kind, text });
    setTimeout(() => setStatus(null), 6000);
  }

  async function doExportEncrypted(passphrase: string) {
    setBusy(true);
    try {
      const envelope = await exportEncryptedBackup(passphrase);
      download(`ava-backup-${today()}.ava-backup`, envelope, 'application/octet-stream');
      flash('ok', 'Encrypted backup saved. Keep your passphrase safe — without it the file can’t be opened.');
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Could not create the backup.');
    } finally {
      setBusy(false);
      setPassModal(null);
      setPass('');
    }
  }

  function doExportReadable() {
    setBusy(true);
    try {
      download(`ava-data-${today()}.json`, exportReadableBundle(), 'application/json');
      flash('ok', 'Readable export saved. Anyone with this file can read it — keep it private.');
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Could not create the export.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport(content: string, passphrase?: string) {
    setBusy(true);
    try {
      const { result } = await importBackup(content, { passphrase });
      const added = result.projected.length ? `Added ${result.projected.join(', ')}.` : 'Nothing new to add.';
      const skipped = result.skipped > 0 ? ` ${result.skipped} already existed, left as-is.` : '';
      flash('ok', `${added} ${result.carried} items carried over.${skipped}`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Could not import that file.');
    } finally {
      setBusy(false);
      setPassModal(null);
      setPass('');
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    const content = await file.text();
    if (isSealedEnvelope(content)) {
      setPassModal({ mode: 'import', content });
    } else {
      await runImport(content);
    }
  }

  const btn = 'w-full font-medium py-2.5 rounded-xl transition text-sm disabled:opacity-50';

  return (
    <div>
      <h3 className="text-[11px] font-bold text-gray-500 tracking-wider mb-2">BACKUP &amp; TRANSFER</h3>
      <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Make a backup file, or move your data here from the desktop app. It&apos;s the same
          file the IDE and extension use &mdash; tasks, journal, health and personality load
          straight in; anything else is carried along untouched.
        </p>

        <button
          onClick={() => setPassModal({ mode: 'export' })}
          disabled={busy}
          className={`${btn} bg-ava-purple hover:bg-ava-purple-dark text-white`}
        >
          {'\u{1F512}'} Export encrypted backup (.ava-backup)
        </button>

        <button
          onClick={doExportReadable}
          disabled={busy}
          className={`${btn} bg-ava-surface border border-ava-border hover:border-ava-purple text-white`}
        >
          Export readable copy (.json)
        </button>

        <div className="pt-1 border-t border-ava-border">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={`${btn} mt-3 bg-ava-surface border border-ava-border hover:border-ava-purple text-white`}
          >
            {'↑'} Import a backup file
          </button>
          <p className="text-[11px] text-gray-500 mt-2 text-center">
            Existing data is kept &mdash; importing only adds what&apos;s new.
          </p>
        </div>

        <input ref={fileRef} type="file" accept=".ava-backup,.json,application/json" onChange={onFilePicked} className="hidden" />

        {status && (
          <p className={`text-[11px] leading-relaxed ${status.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {status.text}
          </p>
        )}
      </div>

      {passModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { if (!busy) { setPassModal(null); setPass(''); } }}>
          <div className="bg-ava-surface border border-ava-border rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-white mb-1">
              {passModal.mode === 'export' ? 'Choose a passphrase' : 'Enter the passphrase'}
            </h4>
            <p className="text-[11px] text-gray-500 mb-3">
              {passModal.mode === 'export'
                ? 'This locks the backup file. You’ll need the exact passphrase to open it on any device — there’s no recovery.'
                : 'This file is encrypted. Enter the passphrase it was created with.'}
            </p>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              placeholder="Passphrase"
              className="w-full bg-ava-bg border border-ava-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-ava-purple transition"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pass) {
                  if (passModal.mode === 'export') doExportEncrypted(pass);
                  else runImport(passModal.content!, pass);
                }
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setPassModal(null); setPass(''); }}
                disabled={busy}
                className="flex-1 bg-ava-surface border border-ava-border text-gray-300 font-medium py-2 rounded-xl text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => passModal.mode === 'export' ? doExportEncrypted(pass) : runImport(passModal.content!, pass)}
                disabled={busy || !pass}
                className="flex-1 bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2 rounded-xl text-sm disabled:opacity-50"
              >
                {busy ? 'Working…' : passModal.mode === 'export' ? 'Create backup' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
