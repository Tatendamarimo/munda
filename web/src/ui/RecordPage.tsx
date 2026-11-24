import { CloudRain, History, Repeat, Share2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { repository, type ObservationItem } from '../data/repository';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { demoMode, demoObservations } from '../dev/fixtures';
import type { PatternKind } from '../domain/models';
import { formatDate, labelArea, labelOnset, labelPattern, labelRain, labelSource, labelStage, useLang, useT } from '../i18n';
import { Badge, QueuedBadge, SyncBadge, Working } from './components';
import { PageHead } from './Header';
import { HybridTrail } from './HybridTrail';
import { CallOfficer, CauseList, RecordView } from './RecordView';
import { back, href } from './router';

const PATTERN_ICON: Record<PatternKind, typeof TrendingUp> = {
  WORSENING: TrendingUp, SPREADING: Share2, WEATHER_LINKED: CloudRain, RECURRING_ON_PLOT: Repeat, OTHER: History,
};

export function PatternPill({ kind }: { kind: PatternKind }) {
  const lang = useLang();
  const Icon = PATTERN_ICON[kind];
  return <span className={`pill pill-${kind}`}><Icon size={14} strokeWidth={2.25} aria-hidden="true" />{labelPattern(kind, lang)}</span>;
}

function useItem(id: string): ObservationItem | null | undefined {
  const s = useStore(session);
  const orgId = s.kind === 'ready' ? s.orgId : null;
  const [item, setItem] = useState<ObservationItem | null | undefined>(undefined);
  useEffect(() => (orgId ? repository.observe(orgId, id, setItem) : undefined), [orgId, id]);
  if (import.meta.env.DEV && demoMode()) return demoObservations().find((d) => d.observation.id === id) ?? null;
  return item;
}

export function RecordPage({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const item = useItem(id);

  if (item === undefined) return <><PageHead onBack={back} /><div className="page"><Working>{t('record.loading')}</Working></div></>;
  if (item === null) return <><PageHead onBack={back} /><div className="page"><p>{t('record.notAvailable')}</p></div></>;
  const o = item.observation;
  const review = o.review;

  return (
    <>
      <PageHead onBack={back} title={o.plot} />
      <div className="page" style={{ gap: 16 }}>
        <div className="badges">
          <SyncBadge synced={item.synced} />
          <span className="muted small">{formatDate(o.createdAtMillis, lang)}</span>
        </div>

        <HybridTrail observation={o} synced={item.synced} />

        {o.record ? (
          <RecordView record={o.record} origin={o.origin} />
        ) : o.recordError ? (
          <p className="error">{t('record.error', { error: o.recordError })}</p>
        ) : (
          <div className="card stack"><QueuedBadge /><p>{t('record.queued')}</p></div>
        )}

        <section className="card stack review-card">
          <h2 className="section-title"><History size={20} strokeWidth={2.25} aria-hidden="true" />{t('record.review')}</h2>
          {!o.record ? <p className="muted">{t('record.reviewAfterRecord')}</p>
            : o.reviewStatus === 'NOT_STARTED' ? <p className="muted">{t('record.reviewPending')}</p>
            : o.reviewStatus === 'FAILED' ? <p className="error">{t('record.reviewFailed')}</p>
            : review ? (
              <>
                {review.patterns.length > 0 && (
                  <div className="pills">{review.patterns.map((p) => <PatternPill key={p.kind + p.summary} kind={p.kind} />)}</div>
                )}
                <p>{review.summary}</p>
                {review.patterns.length > 0 && (
                  <ul className="pattern-notes">
                    {review.patterns.map((p) => <li key={p.kind + p.summary}>{p.summary} <Badge tone="quiet">{labelSource(p.source, lang)}</Badge></li>)}
                  </ul>
                )}
                <p className="muted small">{t('record.basedOn', { n: review.historyConsidered })}</p>
                {review.nextChecks.length > 0 && (
                  <>
                    <p className="tag">{t('record.nextChecks')}</p>
                    <ol className="numbered">{review.nextChecks.map((c) => <li key={c}>{c}</li>)}</ol>
                  </>
                )}
                {review.updatedCauses.length > 0 && (
                  <>
                    <p className="tag">{t('record.causesWithHistory')}</p>
                    <CauseList causes={review.updatedCauses} />
                  </>
                )}
              </>
            ) : null}
        </section>

        <section className="card stack">
          <h2 className="section-title">{t('record.whatRecorded')}</h2>
          <dl className="facts">
            <div><dt>{t('record.crop')}</dt><dd>{t('home.cropLine')}, {labelStage(o.cropStage, lang).toLowerCase()}</dd></div>
            <div><dt>{t('record.affected')}</dt><dd>{labelArea(o.core.area, lang)}</dd></div>
            <div><dt>{t('record.rain')}</dt><dd>{labelRain(o.core.rainfall, lang)}</dd></div>
            <div><dt>{t('record.noticed')}</dt><dd>{labelOnset(o.core.onset, lang)}</dd></div>
          </dl>
          <blockquote className="quote">{o.description}</blockquote>
          {o.followUps.length > 0 && (
            <dl className="qa">{o.followUps.map((f) => <div key={f.question}><dt>{f.question}</dt><dd>{f.answer}</dd></div>)}</dl>
          )}
          {o.hadPhoto && <p className="muted small">{t('record.photoNote')}</p>}
          <a className="muted-link" href={href({ name: 'plot', key: o.plotKey })}>{t('plots.history')} · {o.plot}</a>
        </section>

        <CallOfficer />
      </div>
    </>
  );
}
