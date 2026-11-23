import { Check, CloudRain, Camera, ChevronRight, HardDrive, MapPin, Sun, TriangleAlert } from 'lucide-react';
import { connectivity } from '../data/connectivity';
import { cropWeeks, prefs } from '../data/prefs';
import { useStore } from '../data/store';
import { weather } from '../data/weather';
import { farmSummary, latestAlert, plotsFrom, timeline } from '../domain/farm';
import { labelPattern, labelStage, useLang, useT, weekday } from '../i18n';
import { Hero } from './Header';
import { href, navigate } from './router';
import { StatusPill } from './StatusPill';
import { TimelineBars } from './TimelineBars';
import { useObservations } from './useObservations';

export function HomePage() {
  const t = useT();
  const lang = useLang();
  const items = useObservations() ?? [];
  const p = useStore(prefs);
  const w = useStore(weather);
  const online = useStore(connectivity);

  const observations = items.map((i) => i.observation);
  const plots = plotsFrom(observations);
  const summary = farmSummary(plots);
  const alert = latestAlert(observations);
  const unsynced = items.some((i) => !i.synced);
  const active = plots[0];
  const weeks = active ? cropWeeks(p.plantedAt[active.key], Date.now()) : null;
  const stage = active && active.latest.cropStage !== 'UNKNOWN' ? labelStage(active.latest.cropStage, lang) : null;
  const cropLine = [t('home.cropLine'), weeks !== null ? t('home.weeks', { weeks }) : null, stage].filter(Boolean).join(' · ');

  const meta = (
    <>
      {p.place && <span><MapPin size={14} strokeWidth={2.25} aria-hidden="true" />{p.place}</span>}
      {w && (
        <span>
          {w.rainSoon ? <CloudRain size={14} strokeWidth={2.25} aria-hidden="true" /> : <Sun size={14} strokeWidth={2.25} aria-hidden="true" />}
          {t('home.temp', { temp: w.tempC })} · {w.rainSoon && w.rainDay !== null ? t('home.rainOn', { day: weekday(w.rainDay, lang) }) : t('home.noRain')}
        </span>
      )}
    </>
  );

  return (
    <>
      <Hero right={<StatusPill />} meta={p.place || w ? meta : undefined}>
        <div>
          <h1>{p.name ? t('home.greeting', { name: p.name }) : t('home.greetingNoName')}</h1>
          <p className="hero-sub">{cropLine}</p>
        </div>
        <div className="stats">
          <div className="stat"><b>{summary.plots}</b><span>{t('home.statPlots')}</span></div>
          <div className={`stat${summary.needsCheck ? ' stat-warn' : ''}`}><b>{summary.needsCheck}</b><span>{t('home.statNeedsCheck')}</span></div>
          <div className="stat"><b>{unsynced || !online ? <HardDrive size={22} strokeWidth={2.4} aria-hidden="true" /> : <Check size={24} strokeWidth={2.8} aria-hidden="true" />}</b><span>{unsynced || !online ? t('home.statSaved') : t('home.statSynced')}</span></div>
        </div>
      </Hero>

      <button className="action-card" onClick={() => navigate({ name: 'observe' })}>
        <span className="action-icon"><Camera size={28} strokeWidth={2.2} aria-hidden="true" /></span>
        <span><b>{t('home.checkCrop')}</b><small>{t('home.checkCropSub')}</small></span>
        <ChevronRight className="chev" size={22} aria-hidden="true" />
      </button>

      <div className="page" style={{ marginTop: 16 }}>
        {alert && (
          <a className="alert-card" href={href({ name: 'record', id: alert.observation.id })}>
            <TriangleAlert size={22} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <b>{t('home.alert')} · {alert.observation.plot}</b><br />
              {labelPattern(alert.pattern.kind, lang)}. <span className="muted">{alert.observation.review?.nextChecks[0] ?? alert.pattern.summary}</span>
            </span>
          </a>
        )}

        {active ? (
          <>
            <div className="section-head">
              <span className="tag">{t('home.timeline')} · {active.name}</span>
              <a className="muted-link" href={href({ name: 'plots' })}>{t('common.seeAll')}</a>
            </div>
            <a href={href({ name: 'plot', key: active.key })} style={{ textDecoration: 'none', color: 'inherit' }}>
              <TimelineBars points={timeline(observations, active.key)} />
            </a>
          </>
        ) : (
          <p className="hint-card">{t('home.emptyHint')}</p>
        )}
      </div>
    </>
  );
}
