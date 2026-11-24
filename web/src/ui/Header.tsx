import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { href } from './router';

/** Ground line of the hill, so the plants stand on it. */
const groundY = (x: number) => 96 - 8 * Math.sin((x / 220) * Math.PI + 0.5);

/**
 * Beside the greeting: a sun, a hill and a few maize plants that sway slightly. Drawn, not a
 * photo, so it's sharp at any size, costs nothing offline and never looks like stock.
 */
function FieldScene() {
  const plants = [22, 48, 76, 102, 130, 156, 184].map((x, i) => ({ x, y: groundY(x), h: 44 + ((i * 7) % 4) * 5, delay: (i % 3) * 0.6 }));
  return (
    <svg className="hero-scene" viewBox="0 0 220 100" aria-hidden="true">
      <circle className="scene-sun" cx="176" cy="22" r="13" />
      <path className="scene-hill" d={`M0 ${groundY(0)}${Array.from({ length: 12 }, (_, i) => ` L${i * 20} ${groundY(i * 20).toFixed(1)}`).join('')} V110 H0Z`} />
      {plants.map((p) => (
        <g key={p.x} className="scene-plant" transform={`translate(${p.x} ${p.y.toFixed(1)})`}>
          <g style={{ animationDelay: `${p.delay}s` }}>
            <path className="stalk" d={`M0 0V${-p.h}`} />
            <path className="leaf" d={`M0 ${-p.h * 0.3}C5 ${-p.h * 0.42} 12 ${-p.h * 0.42} 17 ${-p.h * 0.3}C12 ${-p.h * 0.34} 6 ${-p.h * 0.32} 0 ${-p.h * 0.24}Z`} />
            <path className="leaf" d={`M0 ${-p.h * 0.5}C-5 ${-p.h * 0.62} -12 ${-p.h * 0.62} -17 ${-p.h * 0.5}C-12 ${-p.h * 0.54} -6 ${-p.h * 0.52} 0 ${-p.h * 0.44}Z`} />
            <path className="leaf" d={`M0 ${-p.h * 0.7}C4 ${-p.h * 0.8} 9 ${-p.h * 0.8} 13 ${-p.h * 0.72}C9 ${-p.h * 0.75} 4 ${-p.h * 0.73} 0 ${-p.h * 0.65}Z`} />
            <ellipse className="cob" cx="-2.5" cy={-p.h * 0.6} rx="2.2" ry="5" />
            <path className="stalk" d={`M0 ${-p.h}l-3 -6M0 ${-p.h}l3 -6M0 ${-p.h}v-7`} />
          </g>
        </g>
      ))}
    </svg>
  );
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
