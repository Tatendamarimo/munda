import { BookOpen, Check, CloudRain, Camera, HardDrive, MapPin, Sprout, Sun, TriangleAlert } from 'lucide-react';
import { account } from '../data/session';
import { mundaAi } from '../ai/mundaAi';
import { connectivity } from '../data/connectivity';
import { cropWeeks, prefs } from '../data/prefs';
import { useStore } from '../data/store';
import { freshWeather, weather } from '../data/weather';
import { farmSummary, latestAlert, plotsFrom, timeline } from '../domain/farm';
import { causeDisplay } from '../domain/localize';
import { guideFor } from '../domain/guide';
import { labelPattern, labelStage, relativeTime, useLang, useT, weekday } from '../i18n';
import { Hero } from './Header';
import { GroupAlertCard } from './GroupAlertCard';
import { GuideThumb } from './GuidePicture';
import { FieldArtwork } from './FieldArtwork';
import { href, navigate } from './router';
import { StatusPill } from './StatusPill';
import { OriginBadge, Working } from './components';
import { TimelineBars } from './TimelineBars';
import { useObservations } from './useObservations';

export function HomePage() {
  const t = useT();
  const identity = useStore(account);
  const lang = useLang();
  const items = useObservations();
  const p = useStore(prefs);
  const w = freshWeather(useStore(weather), Date.now());
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const observations = (items ?? []).map((i) => i.observation);
  const plots = plotsFrom(observations);
  const summary = farmSummary(plots);
  const alert = latestAlert(observations);
  const unsynced = (items ?? []).some((i) => !i.synced);
  const active = plots[0];
  const weeks = active ? cropWeeks(p.plantedAt[active.key], Date.now()) : null;
  const stage = active && active.latest.cropStage !== 'UNKNOWN' ? labelStage(active.latest.cropStage, lang) : null;
  const cropLine = [t('home.cropLine'), weeks !== null ? t('home.weeks', { weeks }) : null, stage].filter(Boolean).join(' · ');
  const readiness = local.state === 'AVAILABLE' ? 'studio.supported' : local.state === 'UNAVAILABLE' ? 'studio.cloudOnly' : local.state === 'UNKNOWN' ? 'studio.checking' : 'studio.download';
  const meta = <>{p.place && <span><MapPin size={15} aria-hidden="true" />{p.place}</span>}{w && <span>{w.rainSoon ? <CloudRain size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}{t('home.temp', { temp: w.tempC })} · {w.rainSoon && w.rainDay !== null ? t('home.rainOn', { day: weekday(w.rainDay, lang) }) : t('home.noRain')}</span>}</>;
  return <>
    <Hero right={<StatusPill />} meta={p.place || w ? meta : undefined}>
      <span className="eyebrow hero-eyebrow">{t('studio.overview')}</span>
      <div className="hero-greeting"><div><h1>{p.name ? t('home.greeting', { name: p.name }) : t('studio.journal')}</h1><p className="hero-sub">{cropLine}</p></div><span className="hero-season"><Sprout size={22} aria-hidden="true" /></span></div>
      <div className="stats">
        <a className="stat" href={href({ name: 'plots' })}><b>{items === null ? '—' : summary.plots}</b><span>{t('home.statPlots')}</span></a>
        <a className={`stat${summary.needsCheck ? ' stat-warn' : ''}`} href={href({ name: 'plots' })}><b>{items === null ? '—' : summary.needsCheck}</b><span>{t('home.statNeedsCheck')}</span></a>
        <div className="stat"><b>{unsynced || !online ? <HardDrive size={24} aria-hidden="true" /> : <Check size={26} aria-hidden="true" />}</b><span>{unsynced || !online ? t('home.statSaved') : t('home.statSynced')}</span></div>
      </div>
    </Hero>
    <div className="dashboard page">
      <section className="scout-card">
        <div className="scout-copy"><span className="eyebrow">{t('studio.fieldCheck')}</span><h2>{t('home.checkCrop')}</h2><p>{t('home.checkCropSub')}</p><button className="btn btn-maize" onClick={() => navigate({ name: 'observe' })}><Camera size={21} aria-hidden="true" />{t('home.checkCrop')}</button></div>
        <div className="scout-visual"><FieldArtwork compact /></div>
      </section>
      <div className="dashboard-main">
        <GroupAlertCard />
        {alert && <a className="alert-card" href={href({ name: 'record', id: alert.observation.id })}><TriangleAlert size={23} aria-hidden="true" /><span><b>{t('home.alert')} · {alert.observation.plot}</b><span className="alert-description">{labelPattern(alert.pattern.kind, lang)}. {alert.observation.review?.nextChecks[0] ?? alert.pattern.summary}</span></span></a>}
        {items === null ? <Working>{t('common.loading')}</Working> : active ? <>
          <div className="section-head"><h2>{t('home.timeline')}</h2><a className="muted-link" href={href({ name: 'plots' })}>{t('common.seeAll')}</a></div>
          <a className="timeline-link" href={href({ name: 'plot', key: active.key })}><div className="timeline-heading"><b>{active.name}</b><span className={`pill plot-status-${active.status}`}>{t(`enums.plotStatus.${active.status}`)}</span></div><TimelineBars points={timeline(observations, active.key)} /></a>
          <div className="section-head"><h2>{t('studio.recent')}</h2></div>
          <div className="recent-list">{(items ?? []).slice(0, 3).map(({ observation: o }) => {
            const lead = o.record?.possibleCauses[0];
            const d = lead ? causeDisplay(lead, lang, guideFor('MAIZE')) : null;
            return <a className="recent-row" key={o.id} href={href({ name: 'record', id: o.id })}><GuideThumb id={lead?.guideId ?? 'nitrogen'} /><span className="recent-copy"><b>{o.plot}</b><span>{d?.name ?? t('enums.sync.QUEUED')}</span><small>{relativeTime(o.createdAtMillis, Date.now(), lang)}</small></span><OriginBadge origin={o.origin} /></a>;
          })}</div>
        </> : <section className="empty-state"><span className="empty-icon"><Sprout size={32} /></span><h2>{t('studio.emptyTitle')}</h2><p>{t('studio.emptyHelp')}</p><button className="btn btn-secondary" onClick={() => navigate({ name: 'observe' })}>{t('studio.firstCheck')}</button></section>}
      </div>
      <aside className="dashboard-aside">
        {identity.kind === 'guest' && observations.length > 0 && <section className="protect-reminder"><h3>{t('auth.guestNotice')}</h3><p>{t('auth.protectHelp')}</p><a className="btn btn-secondary" href={href({name:'me'})}>{t('auth.protect')}</a></section>}
        <section className="device-card"><div className="section-head"><span className="eyebrow">{t('me.offlineAi')}</span><HardDrive size={20} aria-hidden="true" /></div><h3>{t(readiness)}</h3><p>{t('studio.deviceHelp')}</p><a className="muted-link" href={href({ name: 'me' })}>{t('common.details')}</a></section>
        <a className="guide-feature" href={href({ name: 'guide' })}><span className="empty-icon"><BookOpen size={24} aria-hidden="true" /></span><h3>{t('studio.library')}</h3><p>{t('studio.libraryHelp')}</p><span className="muted-link">{t('studio.learn')}</span></a>
      </aside>
    </div>
  </>;
}
