import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { href } from './router';

/** Restrained contour lines echo cultivated land without adding clip-art plants. */
function FieldScene() {
  return <svg className="hero-scene" viewBox="0 0 220 100" fill="none" aria-hidden="true">
    {[0,1,2,3,4,5,6].map((n) => <path key={n} d={`M${-20+n*5} ${100+n*7}C${70+n*8} ${-30+n*7} ${130+n*9} ${130+n*3} 240 ${4+n*12}`} stroke={n===3 ? '#E3C66B' : '#C5D9B7'} strokeOpacity={n===3 ? .5 : .3} strokeWidth={n===3 ? 1.2 : .7} />)}
  </svg>;
}

/** The deep-green home header. Children carry the greeting, stats and anything screen-specific. */
export function Hero({ meta, right, children }: { meta?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="hero">
      <div className="hero-inner">
        <FieldScene />
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
