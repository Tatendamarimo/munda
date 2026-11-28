import { Cloud, CloudFog, CloudLightning, CloudRain, Droplets, RefreshCw, Snowflake, Sun, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { freshWeather, weather, weatherEnabled, weatherRequest, placeNotFound, setWeatherEnabled, refreshWeather, visibleForecastDays, weatherCondition, forecastDate } from '../data/weather';
import { connectivity } from '../data/connectivity';
import { prefs } from '../data/prefs';
import { useStore } from '../data/store';
import { relativeTime, useLang, useT } from '../i18n';
import { href } from './router';

function ConditionsIcon({ code, size = 24 }: { code?: number | null; size?: number }) {
  const kind = weatherCondition(code);
  const Icon = kind === 'sunny' ? Sun : kind === 'wet' ? CloudRain : kind === 'storm' ? CloudLightning : kind === 'fog' ? CloudFog : kind === 'snow' ? Snowflake : Cloud;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
const number = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value * 10) / 10}${suffix}`;

export function WeatherCard() {
  const t = useT(); const lang = useLang();
  const enabled = useStore(weatherEnabled); const stored = useStore(weather); const request = useStore(weatherRequest);
  const online = useStore(connectivity); const area = useStore(prefs).place.trim(); const missing = useStore(placeNotFound);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const w = stored?.areaKey === area ? freshWeather(stored, now) : null;
  const days = w ? visibleForecastDays(w, now) : [];
  const stale = w && now - w.at > 3 * 3600000;
  const label = (date: string) => {
    if (w && date === forecastDate(now, w.timezone)) return t('weather.today');
    if (w && date === forecastDate(now + 86400000, w.timezone)) return t('weather.tomorrow');
    return new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  };
  return <section className="weather-card" aria-label={t('weather.title')}>
    <div className="weather-heading"><div><span className="eyebrow">{t('weather.title')}</span><p className="weather-place">{w?.where || area || t('weather.choose')}</p></div>
      {enabled && <button type="button" className="weather-refresh" aria-label={t('weather.refresh')} title={t('weather.refresh')} disabled={!online || request === 'loading' || !area} onClick={() => void refreshWeather(true)}><RefreshCw size={19} className={request === 'loading' ? 'weather-spinning' : ''} aria-hidden="true" /></button>}
    </div>
    {!enabled ? <div className="weather-empty"><p>{t(area ? 'weather.privacy' : 'weather.choose')}</p>{area ? <button type="button" className="btn btn-secondary" onClick={() => setWeatherEnabled(true)}>{t('weather.enable')}</button> : <a className="muted-link" href={href({ name: 'me' })}>{t('weather.change')}</a>}</div> : w ? <>
      <div className="weather-now"><div className="weather-temperature"><span className="weather-symbol"><ConditionsIcon code={w.code} size={42} /></span><div><strong>{w.tempC}<span>°C</span></strong><p>{t(`weather.${weatherCondition(w.code)}`)}</p></div></div><div className="weather-measures"><span><Wind size={16} aria-hidden="true" />{t('weather.wind')} <b>{number(w.windKph, ' km/h')}</b></span><span><Droplets size={16} aria-hidden="true" />{t('weather.humidity')} <b>{number(w.humidity, '%')}</b></span></div></div>
      {days.length > 0 && <div className="weather-outlook"><p className="weather-outlook-title">{t('weather.forecast')} · {t('weather.rain')} (mm) / {t('weather.chance')} (%)</p><div className="weather-days" role="list">{days.map(day => <div className="weather-day" role="listitem" key={day.date} aria-label={`${label(day.date)}: ${t(`weather.${weatherCondition(day.code)}`)}`}><b>{label(day.date)}</b><ConditionsIcon code={day.code} /><span className="weather-range" aria-label={t('weather.highLow')}>{day.maxC === null ? '—' : Math.round(day.maxC)}° <small>{day.minC === null ? '—' : Math.round(day.minC)}°</small></span><span className="weather-rain" title={t('weather.rain')}>{number(day.rainMm, ' mm')}</span><small title={t('weather.chance')}>{number(day.rainChance, '%')}</small></div>)}</div></div>}
      <div className="weather-foot"><p role="status">{`${!online ? t('weather.offline') + ' · ' : stale ? t('weather.saved') + ' · ' : ''}${t('weather.updated', { time: relativeTime(w.at, now, lang) })}`}</p><a href={href({ name: 'me' })}>{t('weather.change')}</a></div>
      <p className="weather-note">{t('weather.note')}</p>
    </> : <p className="weather-empty" role="status">{request === 'loading' ? t('weather.loading') : !area ? t('weather.choose') : missing ? t('weather.notFound') : t('weather.unavailable')} <a href={href({ name: 'me' })}>{t('weather.change')}</a></p>}
    {request === 'error' && w && <p className="hint" role="status">{t('weather.unavailable')}</p>}
    {enabled && <a className="weather-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">{t('weather.source')}</a>}
  </section>;
}
