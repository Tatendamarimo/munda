import { ChevronRight, Sprout } from 'lucide-react';
import { plotsFrom, timeline, type TimelinePoint } from '../domain/farm';
import { relativeTime, useLang, useT } from '../i18n';
import { Working } from './components';
import { PageHead } from './Header';
import { href } from './router';
import { useObservations } from './useObservations';

/** Tiny trend line of affected area; rust when the last record is worse than the first. */
export function Trend({ points }: { points: TimelinePoint[] }) {
  const p = points.slice(-6);
  if (p.length < 2) return null;
  const worse = p[p.length - 1]!.extent > p[0]!.extent;
  const pts = p.map((x, i) => `${(i / (p.length - 1)) * 56 + 2},${20 - x.extent * 5.5}`).join(' ');
  return (
    <svg viewBox="0 0 60 22" width="60" height="22" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={worse ? 'var(--rust)' : 'var(--leaf-2)'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlotsPage() {
  const t = useT();
  const lang = useLang();
  const items = useObservations();
  const observations = (items ?? []).map((i) => i.observation);
  const plots = plotsFrom(observations);
  const now = Date.now();
  return (
    <>
      <PageHead title={t('plots.title')} />
      <div className="page">
        {items === null ? <Working>{t('common.loading')}</Working>
          : plots.length === 0 ? (
            <div className="hint-card stack"><Sprout size={26} strokeWidth={1.75} aria-hidden="true" /><p>{t('plots.empty')}</p></div>
          ) : plots.map((p) => (
            <a key={p.key} className="plot-row" href={href({ name: 'plot', key: p.key })}>
              <span className={`dot dot-${p.status}`} aria-label={t(`enums.plotStatus.${p.status}`)} />
              <span style={{ flex: 1 }}>
                <b>{p.name}</b>
                <small>{t(`enums.plotStatus.${p.status}`)} · {t('plots.lastChecked', { when: relativeTime(p.lastAt, now, lang) })} · {t('plots.records', { n: p.count })}</small>
              </span>
              <Trend points={timeline(observations, p.key)} />
              <ChevronRight size={20} className="muted" aria-hidden="true" />
            </a>
          ))}
      </div>
    </>
  );
}
