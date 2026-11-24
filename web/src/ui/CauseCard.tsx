import { Check, ChevronDown, Eye, CircleHelp } from 'lucide-react';
import { guideFor } from '../domain/guide';
import { causeDisplay } from '../domain/localize';
import type { PossibleCause } from '../domain/models';
import { useLang, useT } from '../i18n';
import { KernelMeter } from './components';
import { GuidePicture } from './GuidePicture';

/** "Check before buying anything": the one thing a farmer should do before spending money. */
export function CheckFirst({ text }: { text: string }) {
  const t = useT();
  return (
    <aside className="check-first">
      <p className="check-first-title"><Eye size={16} strokeWidth={2.25} aria-hidden="true" />{t('result.checkFirst')}</p>
      <p>{text}</p>
    </aside>
  );
}

function Evidence({ cause }: { cause: PossibleCause }) {
  const t = useT();
  if (!cause.supporting.length && !cause.againstOrMissing.length) return null;
  return (
    <ul className="evidence" aria-label={`${t('result.fits')} / ${t('result.gaps')}`}>
      {cause.supporting.map((s) => <li key={`+${s}`} className="ev-yes"><Check size={17} strokeWidth={2.6} aria-label={t('result.fits')} />{s}</li>)}
      {cause.againstOrMissing.map((s) => <li key={`-${s}`} className="ev-no"><CircleHelp size={17} strokeWidth={2.6} aria-label={t('result.gaps')} />{s}</li>)}
    </ul>
  );
}

/**
 * A possible cause. The leading one is a full card ending in the check to do before spending
 * money; the others are compact rows that open. Names and checks come from the guide in the
 * farmer's language (causeDisplay); the model's own wording sits under its note.
 */
export function CauseCard({ cause, lead = false, animate = false }: { cause: PossibleCause; lead?: boolean; animate?: boolean }) {
  const t = useT();
  const lang = useLang();
  const d = causeDisplay(cause, lang, guideFor('MAIZE'));
  const body = (
    <>
      {!cause.guideId && <p className="outside-guide">{t('result.outsideGuide')}</p>}
      <Evidence cause={cause} />
      <CheckFirst text={d.check} />
      {d.modelCheck && <p className="model-note"><b>{t('result.modelNote')}:</b> {d.modelCheck}</p>}
    </>
  );
  if (lead) {
    return (
      <article className={`cause-card lk-${cause.likelihood.toLowerCase()}`}>
        <header className="cause-card-head">
          <h3>{d.name}</h3>
          <KernelMeter likelihood={cause.likelihood} animate={animate} />
        </header>
        {guideFor('MAIZE').get(cause.guideId)?.report && <p className="report-now" role="alert">{t('guide.report')}</p>}
        <p className="cause-context">{t('studio.matches', { n: cause.supporting.length })} · {t('studio.likelihoodHelp')}</p>
        <CheckFirst text={d.check} />
        <Evidence cause={cause} />
        <details className="cause-illustration"><summary>{t('guide.signs')}</summary><GuidePicture id={cause.guideId} alt={d.name} compact /></details>
        {!cause.guideId && <p className="outside-guide">{t('result.outsideGuide')}</p>}
        {d.modelCheck && <p className="model-note"><b>{t('result.modelNote')}:</b> {d.modelCheck}</p>}
      </article>
    );
  }
  return (
    <details className="cause-row">
      <summary>
        <span><b>{d.name}</b></span>
        <KernelMeter likelihood={cause.likelihood} />
        <ChevronDown className="chev" size={20} aria-hidden="true" />
      </summary>
      <div className="cause-row-body">{body}</div>
    </details>
  );
}
