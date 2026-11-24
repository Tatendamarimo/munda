import { CircleAlert, Cloud, CloudUpload, HardDrive, History, Laptop, Sparkles } from 'lucide-react';
import type { Observation } from '../domain/models';
import { aiTrail, type TrailStep } from '../domain/trail';
import { useT, type MessageKey } from '../i18n';

const ICON = { saved: HardDrive, causes: Sparkles, synced: CloudUpload, review: History } as const;

const label = (s: TrailStep): MessageKey => {
  switch (s.id) {
    case 'saved': return 'trail.saved';
    case 'causes': return s.state === 'done' ? (s.where === 'device' ? 'trail.causesDevice' : 'trail.causesCloud') : s.state === 'failed' ? 'trail.causesFailed' : 'trail.causesWaiting';
    case 'synced': return s.state === 'done' ? 'trail.synced' : 'trail.syncWaiting';
    case 'review': return s.state === 'done' ? 'trail.review' : s.state === 'failed' ? 'trail.reviewFailed' : 'trail.reviewWaiting';
  }
};

/**
 * Where Munda's AI worked on this record, step by step: the hybrid path made visible. Device
 * steps are green, cloud steps blue, waiting steps dashed. Updates live as sync and review run.
 */
export function HybridTrail({ observation, synced }: { observation: Observation; synced: boolean }) {
  const t = useT();
  const steps = aiTrail(observation, synced);
  return (
    <section className="trail" aria-label={t('trail.title')}>
      <p className="tag">{t('trail.title')}</p>
      <ol>
        {steps.map((s) => {
          const Icon = s.state === 'failed' ? CircleAlert : ICON[s.id];
          const Where = s.where === 'device' ? Laptop : Cloud;
          return (
            <li key={s.id} className={`trail-step is-${s.state} at-${s.where}`}>
              <span className="trail-node"><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
              <span className="trail-label">{t(label(s))}</span>
              <span className="trail-where"><Where size={12} strokeWidth={2.5} aria-hidden="true" />{s.where === 'device' ? t('trail.device') : t('trail.cloud')}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
