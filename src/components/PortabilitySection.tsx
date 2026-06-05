'use client';

import { useRef, useState } from 'react';
import { t, useLocale } from '@/lib/i18n';
import {
  exportEncryptedBackup,
  exportReadableBundle,
  importBackup,
  isSealedEnvelope,
} from '@/lib/portability';

// Backup & Transfer — the companion's side of the shared .ava-backup format.
// Same file the IDE and extension make, so data moves between your devices
// without the cloud.
export default function PortabilitySection() {
  useLocale(); // re-render on locale change
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
      flash('ok', t('backupSavedEnc'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : t('backupErrExport'));
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
      flash('ok', t('backupSavedReadable'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : t('backupErrExport'));
    } finally {
      setBusy(false);
    }
  }

  async function runImport(content: string, passphrase?: string) {
    setBusy(true);
    try {
      const { result } = await importBackup(content, { passphrase });
      let msg = result.projected.length
        ? t('backupImported').replace('{n}', String(result.carried))
        : t('backupImportedEmpty');
      if (result.skipped > 0) msg += t('backupImportedSkipped').replace('{n}', String(result.skipped));
      flash('ok', msg);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : t('backupErrImport'));
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
      <h3 className="text-[11px] font-bold text-gray-500 tracking-wider mb-2 uppercase">{t('backupSection')}</h3>
      <div className="bg-ava-surface border border-ava-border rounded-xl p-4 space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">{t('backupIntro')}</p>

        <button
          onClick={() => setPassModal({ mode: 'export' })}
          disabled={busy}
          className={`${btn} bg-ava-purple hover:bg-ava-purple-dark text-white`}
        >
          {'\u{1F512}'} {t('backupExportEnc')} (.ava-backup)
        </button>

        <button
          onClick={doExportReadable}
          disabled={busy}
          className={`${btn} bg-ava-surface border border-ava-border hover:border-ava-purple text-white`}
        >
          {t('backupExportReadable')} (.json)
        </button>

        <div className="pt-1 border-t border-ava-border">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={`${btn} mt-3 bg-ava-surface border border-ava-border hover:border-ava-purple text-white`}
          >
            {'↑'} {t('backupImport')}
          </button>
          <p className="text-[11px] text-gray-500 mt-2 text-center">{t('backupImportHint')}</p>
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
              {passModal.mode === 'export' ? t('backupChoosePass') : t('backupEnterPass')}
            </h4>
            <p className="text-[11px] text-gray-500 mb-3">
              {passModal.mode === 'export' ? t('backupChoosePassDesc') : t('backupEnterPassDesc')}
            </p>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              placeholder={t('backupPassphrase')}
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
                {t('cancel')}
              </button>
              <button
                onClick={() => passModal.mode === 'export' ? doExportEncrypted(pass) : runImport(passModal.content!, pass)}
                disabled={busy || !pass}
                className="flex-1 bg-ava-purple hover:bg-ava-purple-dark text-white font-medium py-2 rounded-xl text-sm disabled:opacity-50"
              >
                {busy ? t('backupWorking') : passModal.mode === 'export' ? t('backupCreate') : t('backupImportAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
