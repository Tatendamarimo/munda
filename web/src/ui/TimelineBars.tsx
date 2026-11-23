import { shortDate, useLang, useT } from '../i18n';
import type { TimelinePoint } from '../domain/farm';

/** Affected area per record over time; a blue dot marks records made after heavy rain. */
export function TimelineBars({ points, max = 8 }: { points: TimelinePoint[]; max?: number }) {
  const t = useT();
  const lang = useLang();
  const shown = points.slice(-max);
  if (shown.length === 0) return null;
  const first = shown[0]!;
  const last = shown[shown.length - 1]!;
  return (
    <figure className="card" style={{ margin: 0 }} aria-label={t('plots.trend')}>
      <div className="bars">
        {shown.map((p) => (
          <span
            key={p.id}
            className={`bar bar-${Math.min(p.extent, 3)}${p.heavyRain ? ' bar-rain' : ''}`}
            style={{ height: `${p.extent === 0 ? 12 : Math.round((p.extent / 3) * 100)}%` }}
            title={`${shortDate(p.at, lang)}${p.heavyRain ? ` · ${t('plots.heavyRain')}` : ''}`}
          />
        ))}
      </div>
      <figcaption className="bars-axis">
        <span>{shortDate(first.at, lang)}</span>
        {shown.length > 1 && <span>{shortDate(last.at, lang)}</span>}
      </figcaption>
    </figure>
  );
}
