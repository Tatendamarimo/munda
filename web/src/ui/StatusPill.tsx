import { Download, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState, useId, useRef } from 'react';
import { isNativeIOS } from '../ai/appleNative';
import { mundaAi } from '../ai/mundaAi';
import { connectivity } from '../data/connectivity';
import { useStore } from '../data/store';
import { useT } from '../i18n';

/** Connection + offline-AI state, so it's always clear where Munda's AI will run. Opens to explain and to start the model download. */
export function StatusPill({ light = false }: { light?: boolean }) {
  const t = useT();
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    if (local.state !== 'DOWNLOADING') return;
    const id = setInterval(() => void mundaAi.refreshLocalStatus(), 5000);
    return () => clearInterval(id);
  }, [local.state]);

  const ai =
    local.state === 'AVAILABLE' ? { text: t('status.aiReady'), tone: 'device' }
    : local.state === 'DOWNLOADING' ? { text: isNativeIOS() ? t('status.aiChecking') : t('status.aiDownloading', { pct: local.progress != null ? `${Math.round(local.progress * 100)}%` : '' }).trim(), tone: 'pending' }
    : local.state === 'DOWNLOADABLE' ? { text: t('status.aiNotDownloaded'), tone: 'soil' }
    : local.state === 'UNAVAILABLE' ? { text: t('status.aiCloudOnly'), tone: 'cloud' }
    : { text: t('status.aiChecking'), tone: 'pending' };

  return (
    <div ref={root} className={`status${light ? ' status-light' : ''}`}>
      <button ref={trigger} className="status-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        {online ? <Wifi size={15} strokeWidth={2.25} aria-label={t('status.online')} /> : <WifiOff size={15} strokeWidth={2.25} aria-label={t('status.offline')} />}
        <span className={`status-dot dot-${ai.tone}`} aria-hidden="true" />
        <span>{ai.text}</span>
      </button>
      {open && <StatusDetails id={panelId} />}
    </div>
  );
}

export function StatusDetails({ id }: { id?: string }) {
  const t = useT();
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  return (
    <div id={id} className={id ? 'status-panel' : 'stack'} role={id ? 'region' : undefined} aria-label={id ? t('me.offlineAi') : undefined}>
      {local.detail && <p>{local.detail}</p>}
      <p>{online ? t('status.onlineDetail') : t('status.offlineDetail')}</p>
      {!local.detail && <p>
        {local.state === 'AVAILABLE' && t('status.aiReadyDetail')}
        {local.state === 'UNAVAILABLE' && t('status.aiUnavailableDetail')}
        {(local.state === 'DOWNLOADABLE' || local.state === 'DOWNLOADING' || local.state === 'UNKNOWN') && t('status.aiDownloadDetail')}
      </p>}
      {local.state === 'DOWNLOADING' && local.progress != null && <progress value={local.progress} max={1} aria-label={t('status.aiDownloading', { pct: '' })} />}
      {local.state === 'DOWNLOADABLE' && (
        // Chrome requires a click to start the model download.
        <button className="btn btn-secondary" disabled={!online} onClick={() => void mundaAi.ensureLocalModel()}>
          <Download size={16} strokeWidth={2.25} aria-hidden="true" />{t('status.downloadAi')}
        </button>
      )}
    </div>
  );
}
