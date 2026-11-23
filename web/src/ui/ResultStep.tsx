import type { FieldRecord, InferenceOrigin } from '../domain/models';
import { useT } from '../i18n';
import { Working } from './components';
import { CallOfficer, RecordView } from './RecordView';

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
        <button className="btn btn-primary btn-main" onClick={onSave}>{t('observe.saveForLater')}</button>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <RecordView record={state.record} origin={state.origin} latencyMs={state.latencyMs} animate />
      <div className="actions">
        <CallOfficer />
        <button className="btn btn-maize btn-main" onClick={onSave}>{t('result.save')}</button>
      </div>
    </div>
  );
}
