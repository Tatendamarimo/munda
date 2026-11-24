import type { GuideEntry } from '../domain/guide';
import type { FieldRecord, InferenceOrigin } from '../domain/models';
import type { Route } from '../domain/routing';
import { useT } from '../i18n';
import { Working } from './components';
import { LiveResult } from './LiveResult';
import { CallOfficer, RecordView } from './RecordView';

export type RecordState =
  | { kind: 'idle' }
  /** `text` is the answer so far, streamed. */
  | { kind: 'building'; text: string; startedAt: number; route: Route; candidates: GuideEntry[] }
  | { kind: 'done'; record: FieldRecord; origin: InferenceOrigin; latencyMs: number }
  | { kind: 'problem'; message: string };

export function ResultStep({ state, onSave }: { state: RecordState; onSave: () => void }) {
  const t = useT();
  if (state.kind === 'idle') return <Working>{t('observe.writing')}</Working>;
  if (state.kind === 'building') return <LiveResult text={state.text} startedAt={state.startedAt} route={state.route} candidates={state.candidates} />;
  if (state.kind === 'problem') {
    return (
      <div className="stack">
        {/* Plain words for the farmer; the technical reason only under details. */}
        <p className="lede">{t('observe.cantFinish')}</p>
        <details className="hint"><summary>{t('observe.technical')}</summary>{state.message}</details>
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
