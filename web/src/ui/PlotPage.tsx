import { guideFor } from '../domain/guide';
import { causeDisplay } from '../domain/localize';
import { plotsFrom, timeline } from '../domain/farm';
import { prefs, updatePrefs } from '../data/prefs';
import { useStore } from '../data/store';
import { labelLikelihood, relativeTime, useLang, useT } from '../i18n';
import { Working } from './components';
import { PageHead } from './Header';
import { PatternPill } from './RecordPage';
import { back, href } from './router';
import { TimelineBars } from './TimelineBars';
import { useObservations } from './useObservations';

const toInput = (ms: number | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');

export function PlotPage({ plotKey }: { plotKey: string }) {
  const t = useT();
  const lang = useLang();
  const p = useStore(prefs);
  const items = useObservations();
  if (items === null) return <><PageHead onBack={back} /><div className="page"><Working>{t('common.loading')}</Working></div></>;

  const observations = items.map((i) => i.observation);
  const plot = plotsFrom(observations).find((x) => x.key === plotKey);
  if (!plot) return <><PageHead onBack={back} /><div className="page"><p>{t('record.notAvailable')}</p></div></>;
  const records = observations.filter((o) => o.plotKey === plotKey).sort((a, b) => b.createdAtMillis - a.createdAtMillis);
  const reviewed = records.find((o) => o.review);
  const now = Date.now();

  return (
    <>
      <PageHead onBack={back} title={t('plots.title')} />
      <div className="page" style={{ gap: 14 }}>
        <div>
          <h2 className="page-title">{plot.name}</h2>
          <p className="muted small">{t(`enums.plotStatus.${plot.status}`)} · {plot.count === 1 ? t('plots.recordsOne') : t('plots.records', { n: plot.count })}</p>
        </div>

        <p className="tag">{t('plots.trend')}</p>
        <TimelineBars points={timeline(observations, plotKey)} max={12} />

        <section className="card stack">
          <h3 className="section-title">{t('plots.patterns')}</h3>
          {reviewed?.review ? (
            <>
              {reviewed.review.patterns.length > 0 && <div className="pills">{reviewed.review.patterns.map((x) => <PatternPill key={x.kind + x.summary} kind={x.kind} />)}</div>}
              <p>{reviewed.review.summary}</p>
              {reviewed.review.nextChecks.length > 0 && (
                <>
                  <p className="tag">{t('record.nextChecks')}</p>
                  <ol className="numbered">{reviewed.review.nextChecks.map((c) => <li key={c}>{c}</li>)}</ol>
                </>
              )}
            </>
          ) : <p className="muted">{t('plots.noReview')}</p>}
        </section>

        <label className="card stack" style={{ gap: 6 }}>
          <span className="section-title">{t('plots.planted')}</span>
          <input
            type="date"
            value={toInput(p.plantedAt[plotKey])}
            max={toInput(now)}
            onChange={(e) => {
              const plantedAt = { ...p.plantedAt };
              if (e.target.value) plantedAt[plotKey] = Date.parse(`${e.target.value}T12:00:00`);
              else delete plantedAt[plotKey];
              updatePrefs({ plantedAt });
            }}
          />
          <span className="muted small">{t('plots.plantedHelp')}</span>
        </label>

        <p className="tag">{t('plots.history')}</p>
        {records.map((o) => {
          const lead = o.record?.possibleCauses[0];
          const d = lead ? causeDisplay(lead, lang, guideFor('MAIZE')) : null;
          return (
            <a key={o.id} className="plot-row" href={href({ name: 'record', id: o.id })}>
              <span style={{ flex: 1 }}>
                <b>{d ? d.name : t('enums.sync.QUEUED')}</b>
                <small>{relativeTime(o.createdAtMillis, now, lang)}{lead ? ` · ${labelLikelihood(lead.likelihood, lang)}` : ''}</small>
              </span>
            </a>
          );
        })}
      </div>
    </>
  );
}
