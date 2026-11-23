import type { FieldRecord, InferenceOrigin } from '../domain/models';
import { useT } from '../i18n';
import { Badge, CauseEntry, OriginBadge, UncertaintyNote, UrgencyBadge, Working } from './components';

export type RecordState =
  | { kind: 'idle' }
  | { kind: 'building' }
  | { kind: 'done'; record: FieldRecord; origin: InferenceOrigin; latencyMs: number }
  | { kind: 'problem'; message: string };

export function ResultStep({ state, onSave }: { state: RecordState; onSave: () => void }) {
  const t = useT();
  if (state.kind === 'idle' || state.kind === 'building') return <Working>{t('observe.writing')}</Working>;
  if (state.kind === 'problem') {
    return (
      <div className="stack">
        <p className="lede">{state.message}</p>
        <p>{t('observe.queuedLede')}</p>
        <button className="btn btn-ghost btn-main" onClick={onSave}>{t('observe.saveForLater')}</button>
      </div>
    );
  }
  const r = state.record;
  return (
    <div className="result">
      <div className="badges">
        <OriginBadge origin={state.origin} />
        <UrgencyBadge urgency={r.urgency} />
        <Badge tone="quiet">{t('result.seconds', { s: (state.latencyMs / 1000).toFixed(1) })}</Badge>
      </div>
      <p className="result-summary">{r.summary}</p>
      <UncertaintyNote text={r.uncertaintyNote} />
      <div className="causes">{r.possibleCauses.map((c) => <CauseEntry key={c.guideId ?? c.name} cause={c} animate />)}</div>
      <button className="btn btn-primary btn-main" onClick={onSave}>{t('result.save')}</button>
    </div>
  );
}
