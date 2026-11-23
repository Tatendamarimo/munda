import { CircleHelp, Phone } from 'lucide-react';
import { prefs } from '../data/prefs';
import { useStore } from '../data/store';
import type { FieldRecord, InferenceOrigin, PossibleCause } from '../domain/models';
import { useT } from '../i18n';
import { CauseCard } from './CauseCard';
import { Badge, OriginBadge, UrgencyBadge } from './components';
import { href } from './router';

/** Leading cause first, others as rows; the model's free text (often English on-device) under Details. */
export function CauseList({ causes, animate = false }: { causes: PossibleCause[]; animate?: boolean }) {
  const t = useT();
  const [lead, ...rest] = causes;
  if (!lead) return null;
  return (
    <div className="stack">
      <CauseCard cause={lead} lead animate={animate} />
      {rest.length > 0 && <p className="tag" style={{ marginTop: 6 }}>{t('result.otherCauses')}</p>}
      {rest.map((c) => <CauseCard key={c.guideId ?? c.name} cause={c} />)}
    </div>
  );
}

export function RecordView({ record, origin, latencyMs, animate = false }: { record: FieldRecord; origin: InferenceOrigin; latencyMs?: number; animate?: boolean }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h2 className="page-title">{t('result.title')}</h2>
        <p className="muted small">{t('result.subtitle')}</p>
        <div className="badges" style={{ marginTop: 6 }}>
          <OriginBadge origin={origin} />
          <UrgencyBadge urgency={record.urgency} />
          {latencyMs !== undefined && <Badge tone="quiet">{t('result.seconds', { s: (latencyMs / 1000).toFixed(1) })}</Badge>}
        </div>
      </div>
      <CauseList causes={record.possibleCauses} animate={animate} />
      <details className="details">
        <summary>{t('common.details')}</summary>
        <div className="stack">
          <p className="result-summary">{record.summary}</p>
          <aside className="uncertainty"><CircleHelp size={18} strokeWidth={2.25} aria-hidden="true" /><p><b>{t('result.uncertainty')}:</b> {record.uncertaintyNote}</p></aside>
        </div>
      </details>
    </div>
  );
}

/** Calls the farmer's own extension officer; without one, points to Me to add them. */
export function CallOfficer() {
  const t = useT();
  const p = useStore(prefs);
  if (!p.extension?.phone) {
    return <a className="btn btn-ghost btn-main" href={href({ name: 'me' })} title={t('result.setExtension')}><Phone size={18} strokeWidth={2.25} aria-hidden="true" />{t('result.callExtension')}</a>;
  }
  return <a className="btn btn-ghost btn-main" href={`tel:${p.extension.phone.replace(/[^\d+]/g, '')}`}><Phone size={18} strokeWidth={2.25} aria-hidden="true" />{t('result.callExtension')}{p.extension.name ? ` · ${p.extension.name}` : ''}</a>;
}
