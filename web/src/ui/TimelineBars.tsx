import { CloudRain } from 'lucide-react';
import { shortDate, useLang, useT } from '../i18n';
import type { TimelinePoint } from '../domain/farm';

/** Ordinal reports, not measurements: unknown is explicitly separate from a few plants. */
export function TimelineBars({ points, max = 8 }: { points: TimelinePoint[]; max?: number }) {
  const t = useT();
  const lang = useLang();
  const shown = points.slice(-max);
  if (!shown.length) return null;
  const labels = [t('studio.unknown'), t('studio.few'), t('studio.patches'), t('studio.most')];
  return <figure className="card timeline-chart" aria-label={t('plots.trend')}>
    <div className="chart-labels"><span>{t('plots.trend')}</span>{shown.some((p) => p.heavyRain) && <span><CloudRain size={15} aria-hidden="true" />{t('studio.rainLegend')}</span>}</div>
    <div className="chart-grid"><div className="chart-scale" aria-hidden="true"><span>{labels[3]}</span><span>{labels[2]}</span><span>{labels[1]}</span></div><div className="chart-columns">{shown.map((p) => <div className="chart-column" key={p.id}>
      <div className="chart-bar-slot"><span className={`bar bar-${p.extent}${p.extent === 0 ? ' bar-unknown' : ''}`} style={{ height: p.extent === 0 ? '12%' : `${p.extent / 3 * 100}%` }} role="img" aria-label={`${shortDate(p.at, lang)}: ${labels[p.extent]}${p.heavyRain ? ` · ${t('plots.heavyRain')}` : ''}`} title={`${shortDate(p.at, lang)} · ${labels[p.extent]}`} />{p.heavyRain && <CloudRain className="chart-rain" size={16} aria-hidden="true" />}</div>
      <span className="chart-date">{shortDate(p.at, lang)}</span>
    </div>)}</div></div>
    <figcaption className="chart-note">{t('studio.extentHelp')}</figcaption>
  </figure>;
}
