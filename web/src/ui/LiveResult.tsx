import { Check, Cloud, Laptop, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { GuideEntry } from '../domain/guide';
import { guideFor } from '../domain/guide';
import { localizedEntry } from '../domain/localize';
import { livePreview } from '../domain/partialJson';
import type { Route } from '../domain/routing';
import { useLang, useT } from '../i18n';
import { KernelMeter } from './components';

function useSeconds(since: number) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { const id = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(id); }, []);
  return Math.max(0, (now - since) / 1000);
}

type StepState = 'done' | 'active' | 'todo';
function Step({ state, title, children }: { state: StepState; title: string; children?: ReactNode }) {
  return (
    <li className={`live-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
      <span className="live-mark" aria-hidden="true">{state === 'done' ? <Check size={14} strokeWidth={3} /> : null}</span>
      <div className="live-body"><b>{title}</b>{children}</div>
    </li>
  );
}

/**
 * The answer while the AI writes it: what Munda is weighing, then the summary and the causes as
 * they arrive. Nano on a laptop CPU can take a minute; this makes that minute visibly work.
 * The streamed text is display only; the finished record is parsed strictly.
 */
export function LiveResult({ text, startedAt, route, candidates }: { text: string; startedAt: number; route: Route; candidates: GuideEntry[] }) {
  const t = useT();
  const lang = useLang();
  const seconds = useSeconds(startedAt);
  const preview = livePreview(text);
  const guide = guideFor('MAIZE');
  const named = new Set(preview.causes.map((c) => c.guideId).filter(Boolean));
  const writingCauses = preview.causes.length > 0;
  const onDevice = route === 'ON_DEVICE';

  return (
    <div className="stack live" style={{ gap: 16 }} aria-busy="true">
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="page-title">{t('live.title')}</h2>
        <div className={`live-where ${onDevice ? 'is-device' : 'is-cloud'}`}>
          {onDevice ? <Laptop size={16} strokeWidth={2.25} aria-hidden="true" /> : <Cloud size={16} strokeWidth={2.25} aria-hidden="true" />}
          <span>{onDevice ? t('live.onDevice') : t('live.cloud')}</span>
          <span className="live-clock" aria-hidden="true">{t('result.seconds', { s: seconds.toFixed(1) })}</span>
        </div>
      </div>

      <ol className="live-steps">
        <Step state="done" title={t('live.read')} />
        <Step state="done" title={t('live.compared', { n: candidates.length })}>
          <div className="live-chips">
            {candidates.map((e) => (
              <span key={e.id} className={`live-chip${named.has(e.id) ? ' is-named' : ''}`}>{localizedEntry(e, lang).name}</span>
            ))}
          </div>
        </Step>
        <Step state={writingCauses ? 'done' : 'active'} title={t('live.summary')}>
          {preview.summary && <p className="live-summary">{preview.summary}{!writingCauses && <span className="caret" aria-hidden="true" />}</p>}
        </Step>
        <Step state={writingCauses ? 'active' : 'todo'} title={t('live.ranking')}>
          {writingCauses && (
            <ul className="live-causes">
              {preview.causes.map((c, i) => {
                const entry = c.guideId ? guide.get(c.guideId) : null;
                const name = entry ? localizedEntry(entry, lang).name : c.name;
                if (!name) return null;
                return (
                  <li key={`${i}-${c.guideId ?? ''}`} className="live-cause">
                    <div className="live-cause-head">
                      <span>{name}</span>
                      {c.likelihood ? <KernelMeter likelihood={c.likelihood} animate /> : <span className="working-dot" aria-hidden="true" />}
                    </div>
                    {(c.supporting.length > 0 || c.against.length > 0) && (
                      <ul className="evidence">
                        {c.supporting.map((e, j) => <li key={`+${j}`} className="ev-yes"><Check size={15} strokeWidth={2.6} aria-label={t('result.fits')} />{e}</li>)}
                        {c.against.map((e, j) => <li key={`-${j}`} className="ev-no"><X size={15} strokeWidth={2.6} aria-label={t('result.gaps')} />{e}</li>)}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Step>
      </ol>
    </div>
  );
}
