import { CircleCheck, CircleHelp, Cloud, CloudUpload, HardDrive, Laptop, ListChecks, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { labelLikelihood, labelOrigin, labelUrgency, useLang, useT } from '../i18n';
import type { InferenceOrigin, Likelihood, PossibleCause, Urgency } from '../domain/models';

type Tone = 'device' | 'cloud' | 'pending' | 'soil' | 'ok' | 'quiet' | 'routine' | 'soon' | 'urgent';

export function Badge({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon}{children}</span>;
}

const ic = { size: 14, strokeWidth: 2.25, 'aria-hidden': true } as const;

/** Where the AI actually ran, from the SDK's inferenceSource. Shown on every record. */
export function OriginBadge({ origin }: { origin: InferenceOrigin }) {
  const lang = useLang();
  const text = labelOrigin(origin, lang);
  if (origin === 'ON_DEVICE') return <Badge tone="device" icon={<Laptop {...ic} />}>{text}</Badge>;
  if (origin === 'CLOUD') return <Badge tone="cloud" icon={<Cloud {...ic} />}>{text}</Badge>;
  return <Badge tone="pending" icon={<Timer {...ic} />}>{text}</Badge>;
}

export function SyncBadge({ synced }: { synced: boolean }) {
  const t = useT();
  return synced ? <Badge tone="ok" icon={<CircleCheck {...ic} />}>{t('enums.sync.SYNCED')}</Badge> : <Badge tone="soil" icon={<HardDrive {...ic} />}>{t('enums.sync.LOCAL')}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const lang = useLang();
  return <Badge tone={urgency === 'URGENT' ? 'urgent' : urgency === 'SOON' ? 'soon' : 'routine'}>{labelUrgency(urgency, lang)}</Badge>;
}

export function QueuedBadge() {
  const t = useT();
  return <Badge tone="pending" icon={<CloudUpload {...ic} />}>{t('enums.sync.QUEUED')}</Badge>;
}

const KERNELS = 5;
const filled: Record<Likelihood, number> = { LOW: 1, MEDIUM: 3, HIGH: 4 };

/**
 * Likelihood as maize kernels. "Likely" fills four of five, never five: Munda never claims
 * certainty, and the meter says so without words. Words sit beside it so colour isn't needed.
 */
export function KernelMeter({ likelihood, animate = false }: { likelihood: Likelihood; animate?: boolean }) {
  const lang = useLang();
  const n = filled[likelihood];
  const label = labelLikelihood(likelihood, lang);
  return (
    <div className={`kernels kernels-${likelihood.toLowerCase()}${animate ? ' kernels-animate' : ''}`} role="img" aria-label={`${label}: ${n}/${KERNELS}`}>
      <span className="kernels-label">{label}</span>
      <span className="kernels-row" title="Munda never fills the fifth kernel: it can't be certain from a description.">
        {Array.from({ length: KERNELS }, (_, i) => (
          <svg key={i} viewBox="0 0 10 14" className={i < n ? 'kernel kernel-on' : 'kernel'} style={{ animationDelay: `${120 + i * 90}ms` }}>
            <path d="M5 .8C8 .8 9.4 4 9.4 7.6 9.4 11 7.4 13.2 5 13.2S.6 11 .6 7.6C.6 4 2 .8 5 .8Z" />
          </svg>
        ))}
      </span>
    </div>
  );
}

/** One possible cause, laid out like an entry on an agronomist's scouting sheet. */
export function CauseEntry({ cause, animate }: { cause: PossibleCause; animate?: boolean }) {
  return (
    <article className={`cause cause-${cause.likelihood.toLowerCase()}`}>
      <header className="cause-head">
        <h3>{cause.name}</h3>
        <KernelMeter likelihood={cause.likelihood} animate={animate} />
      </header>
      <div className="cause-evidence">
        {cause.supporting.length > 0 && (
          <section>
            <h4 className="ev-title ev-fits">Fits what you saw</h4>
            <ul>{cause.supporting.map((s) => <li key={s} className="ev-fits-item">{s}</li>)}</ul>
          </section>
        )}
        {cause.againstOrMissing.length > 0 && (
          <section>
            <h4 className="ev-title ev-gaps">Doesn't fit, or still unknown</h4>
            <ul>{cause.againstOrMissing.map((s) => <li key={s} className="ev-gaps-item">{s}</li>)}</ul>
          </section>
        )}
      </div>
      <footer className="cause-check">
        <ListChecks size={18} strokeWidth={2.25} aria-hidden="true" />
        <p><strong>Check next.</strong> {cause.checkNext}</p>
      </footer>
    </article>
  );
}

export const UncertaintyNote = ({ text }: { text: string }) => (
  <aside className="uncertainty">
    <CircleHelp size={18} strokeWidth={2.25} aria-hidden="true" />
    <p>{text}</p>
  </aside>
);

export function ChoiceGroup<T extends string>({ legend, options, selected, label, onSelect }: {
  legend: string; options: readonly T[]; selected: T | undefined; label: (t: T) => string; onSelect: (t: T) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-options" role="radiogroup" aria-label={legend}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === selected} className="option" onClick={() => onSelect(o)}>
            {label(o)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const Working = ({ children }: { children: ReactNode }) => (
  <p className="working" role="status"><span className="working-dot" aria-hidden="true" />{children}</p>
);

/** The observation flow is a real sequence, so it's numbered. */
export function Stepper({ step }: { step: 0 | 1 | 2 }) {
  const steps = ['Describe', 'Questions', 'Possible causes'];
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="stepper-n">{i + 1}</span>
          <span className="stepper-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}
