import { CloudUpload, History, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mundaAi } from '../ai/mundaAi';
import { connectivity } from '../data/connectivity';
import { useStore } from '../data/store';
import { useT } from '../i18n';
import { syncProcessor } from '../sync/syncProcessor';
import { href } from './router';

const SHOW_REVIEW_MS = 8000;

/**
 * One line at the top of every screen for the moments that make hybrid AI visible: no signal
 * (still working on the device), back online and syncing, and a cloud review just added.
 */
export function ConnectionBanner() {
  const t = useT();
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const { busy, lastReview } = useStore(syncProcessor.activity);
  const [, tick] = useState(0);
  const fresh = lastReview !== null && Date.now() - lastReview.at < SHOW_REVIEW_MS;
  useEffect(() => {
    if (!fresh) return;
    const id = setTimeout(() => tick((n) => n + 1), SHOW_REVIEW_MS - (Date.now() - lastReview.at) + 50);
    return () => clearTimeout(id);
  }, [fresh, lastReview]);

  if (!online) {
    return <div className="banner banner-offline" role="status"><WifiOff size={16} strokeWidth={2.5} aria-hidden="true" />{t(local.state === 'AVAILABLE' ? 'status.aiReadyDetail' : 'status.offlineDetail')}</div>;
  }
  if (busy) {
    return <div className="banner banner-sync" role="status"><CloudUpload size={16} strokeWidth={2.5} aria-hidden="true" />{t('banner.syncing')}</div>;
  }
  if (fresh) {
    return (
      <a className="banner banner-review" role="status" href={href({ name: 'record', id: lastReview.id })}>
        <History size={16} strokeWidth={2.5} aria-hidden="true" />{t('banner.reviewed', { plot: lastReview.plot })}
      </a>
    );
  }
  return null;
}
