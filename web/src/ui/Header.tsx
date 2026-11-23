import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { href } from './router';

/** The deep-green home header. Children carry the greeting, stats and anything screen-specific. */
export function Hero({ meta, right, children }: { meta?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="hero">
      <svg className="hero-leaf" viewBox="0 0 340 200" aria-hidden="true"><path d="M170 200C170 120 120 60 40 40c30 70 70 120 130 160zM180 200c0-90 50-150 130-170-20 80-60 140-130 170z" /></svg>
      <div className="hero-inner">
        <div className="hero-top">
          <a className="brand-on-dark" href={href({ name: 'home' })} aria-label="Munda"><img src="/munda-symbol.svg" alt="" />munda</a>
          {right}
        </div>
        {meta && <div className="hero-meta">{meta}</div>}
        {children}
      </div>
    </header>
  );
}

/** Light header for every other screen: back, a short title, and an action slot (read-aloud). */
export function PageHead({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  const t = useT();
  return (
    <div className="page-head">
      {onBack ? (
        <button className="icon-btn" aria-label={t('common.back')} onClick={onBack}><ChevronLeft size={22} strokeWidth={2.25} /></button>
      ) : <span className="icon-spacer" />}
      <h1>{title}</h1>
      {right ?? <span className="icon-spacer" />}
    </div>
  );
}
