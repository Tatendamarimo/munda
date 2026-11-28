import { selectedDeviceArea } from './deviceArea';
import { connectivity } from './connectivity';
import { prefs } from './prefs';
import { coarseCell } from '../domain/groups';
import { Store } from './store';

/**
 * Optional area-specific forecast from Open-Meteo. Refreshes only after consent and while online.
 * Failed updates retain the same area’s cache with an explicit freshness label.
 */
export interface ForecastDay { date: string; minC: number | null; maxC: number | null; rainMm: number | null; rainChance: number | null; code: number | null }
export interface Weather {
  tempC: number;
  humidity?: number | null;
  windKph?: number | null;
  code?: number | null;
  days?: ForecastDay[];
  timezone?: string;
  areaKey?: string;
  /** ≥ 5 mm today or on one of the next 2 days. */
  rainSoon: boolean;
  /** Day of week (0 = Sunday) of the first such day. */
  rainDay: number | null;
  /** Noon (UTC) of that day, to drop rain that has already passed. */
  rainAt: number | null;
  at: number;
  /** The place searched for, when typed rather than located; shown so a wrong match is visible. */
  where?: string | null;
}

const RAIN_MM = 5;
const CACHE = 'munda.weather';
const ENABLED = 'munda.weatherOn';
const MAX_AGE = 3 * 3_600_000;

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function parseOpenMeteo(json: unknown, now: number): Weather | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as { current?: { temperature_2m?: unknown }; daily?: { time?: unknown; precipitation_sum?: unknown } };
  const temp = num(j.current?.temperature_2m);
  const times = j.daily?.time;
  const rain = j.daily?.precipitation_sum;
  if (temp === null || !Array.isArray(times) || !Array.isArray(rain) || times.length !== rain.length) return null;
  // Today and the next 2 days: the window a farmer can still act in.
  let rainDay: number | null = null;
  let rainAt: number | null = null;
  for (let i = 0; i < Math.min(3, times.length); i++) {
    const mm = num(rain[i]);
    if (mm !== null && mm >= RAIN_MM && typeof times[i] === 'string') {
      const d = new Date(`${times[i]}T12:00:00Z`);
      if (!Number.isNaN(d.getTime())) { rainDay = d.getUTCDay(); rainAt = d.getTime(); break; }
    }
  }
  const result: Weather = { tempC: Math.round(temp), rainSoon: rainDay !== null, rainDay, rainAt, at: now };
  const raw = json as { current?: Record<string, unknown>; daily?: Record<string, unknown>; timezone?: unknown };
  if (Array.isArray(raw.daily?.temperature_2m_max)) {
    const value = (key: string, i: number) => { const a = raw.daily?.[key]; return Array.isArray(a) ? num(a[i]) : null; };
    result.days = times.slice(0, 7).flatMap((date, i) => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return [];
      const chance = value('precipitation_probability_max', i);
      return [{ date, minC: value('temperature_2m_min', i), maxC: value('temperature_2m_max', i), rainMm: value('precipitation_sum', i) !== null && value('precipitation_sum', i)! >= 0 ? value('precipitation_sum', i) : null, rainChance: chance !== null && chance >= 0 && chance <= 100 ? chance : null, code: value('weather_code', i) }];
    });
    const humidity = num(raw.current?.relative_humidity_2m);
    result.humidity = humidity !== null && humidity >= 0 && humidity <= 100 ? humidity : null;
    const wind = num(raw.current?.wind_speed_10m);
    result.windKph = wind !== null && wind >= 0 ? wind : null;
    result.code = num(raw.current?.weather_code);
    result.timezone = typeof raw.timezone === 'string' ? raw.timezone : 'UTC';
  }
  return result;
}

const SHOW_FOR = 24 * 3_600_000;

/**
 * What the header may show now: nothing once the forecast is over a day old (offline for days
 * must not read as this week's weather), and no rain once its day has passed.
 */
export function freshWeather(w: Weather | null, now: number): Weather | null {
  if (!w || !Number.isFinite(w.at) || !Number.isFinite(w.tempC) || w.at > now + 60000 || now - w.at > SHOW_FOR) return null;
  if (w.rainAt !== null && w.rainAt !== undefined && now > w.rainAt + 12 * 3_600_000) return { ...w, rainSoon: false, rainDay: null, rainAt: null };
  return w;
}

function readCache(): Weather | null {
  try { const raw = localStorage.getItem(CACHE); return raw ? (JSON.parse(raw) as Weather) : null; } catch { return null; }
}

export const weather = new Store<Weather | null>(typeof window === 'undefined' ? null : readCache());

export const weatherEnabled = new Store<boolean>(typeof window !== 'undefined' && (() => { try { return localStorage.getItem(ENABLED) === '1'; } catch { return false; } })());

export function setWeatherEnabled(on: boolean) {
  weatherEnabled.set(on);
  try {
    if (on) localStorage.setItem(ENABLED, '1');
    else { localStorage.removeItem(ENABLED); localStorage.removeItem(CACHE); }
  } catch { /* best effort */ }
  if (on) void refreshWeather(true);
  else { requestVersion++; weather.set(null); weatherRequest.set('idle'); }
}

export interface Coords { latitude: number; longitude: number; label?: string }

type Place = { latitude?: unknown; longitude?: unknown; name?: unknown; admin1?: unknown; country?: unknown; feature_code?: unknown };
const text = (x: unknown) => (typeof x === 'string' ? x : '');

/**
 * Best match from Open-Meteo's place search: a town or village (feature code PPL…) before a
 * mountain or river of the same name. The label names the province so a wrong match shows.
 */
export function parseGeocode(json: unknown): Coords | null {
  const r = (json as { results?: unknown } | null)?.results;
  const all = Array.isArray(r) ? (r as Place[]).filter((p) => num(p?.latitude) !== null && num(p?.longitude) !== null) : [];
  const best = all.find((p) => text(p.feature_code).startsWith('PPL')) ?? all[0];
  if (!best) return null;
  const label = [text(best.name), text(best.admin1).replace(/ Province$/, ''), text(best.country)].filter(Boolean).join(', ');
  return { latitude: num(best.latitude)!, longitude: num(best.longitude)!, label };
}

const CELL = 'munda.placeCell';
/** The farmer's area as a coarse map square (about 5 km), stored with each check for the group map. */
export const placeCell = new Store<string | null>(typeof window === 'undefined' ? null : (() => { try { return localStorage.getItem(CELL); } catch { return null; } })());

/** Set when the typed area couldn't be found, so Me can say so instead of showing nothing. */
export const placeNotFound = new Store<string | null>(null);


export const weatherRequest = new Store<'idle' | 'loading' | 'error'>('idle');
let requestVersion = 0;
const areaKey = () => prefs.value.place.trim();

export async function refreshWeather(force = false): Promise<void> {
  const area = areaKey();
  // Invalidate a different area's cache even while offline, before the freshness shortcut.
  const cached = weather.value;
  if (cached && cached.areaKey !== area) {
    weather.set(null);
    try { localStorage.removeItem(CACHE); } catch { /* storage unavailable */ }
  }
  const version = ++requestVersion;
  if (!weatherEnabled.value || !connectivity.value) { weatherRequest.set('idle'); return; }
  if (!force && weather.value && Date.now() - weather.value.at < MAX_AGE) { weatherRequest.set('idle'); return; }
  weatherRequest.set('loading');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const current = () => version === requestVersion && weatherEnabled.value && areaKey() === area;
  try {
    const located = selectedDeviceArea();
    const response = !located && area ? await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=10&name=${encodeURIComponent(area)}`, { signal: controller.signal }) : null;
    if (response && !response.ok) throw new Error('Place lookup unavailable');
    const found = response ? parseGeocode(await response.json()) : null;
    if (!current()) return;
    placeNotFound.set(!located && area && !found ? area : null);
    const coords = located ?? found;
    if (!coords) { weatherRequest.set('idle'); return; }
    const cell = coarseCell(coords.latitude, coords.longitude);
    placeCell.set(cell);
    try { localStorage.setItem(CELL, cell); } catch { /* best effort */ }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}`
      + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&forecast_days=7&timezone=auto&wind_speed_unit=kmh';
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error('Forecast unavailable');
    const parsed = parseOpenMeteo(await res.json(), Date.now());
    if (!parsed) throw new Error('Incomplete forecast');
    if (!current()) return;
    const w = { ...parsed, where: found?.label ?? area, areaKey: area };
    weather.set(w);
    try { localStorage.setItem(CACHE, JSON.stringify(w)); } catch { /* keep in memory */ }
    weatherRequest.set('idle');
  } catch {
    if (current()) weatherRequest.set('error');
  } finally { clearTimeout(timeout); }
}

/** WMO codes describe current conditions, not whether a later day might be rainy. */
export function weatherCondition(code: number | null | undefined): 'sunny' | 'cloudy' | 'fog' | 'wet' | 'storm' | 'snow' | 'unknown' {
  if (code === 0) return 'sunny';
  if (code !== null && code !== undefined && code >= 1 && code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([71,73,75,77,85,86].includes(code ?? -1)) return 'snow';
  if ([95,96,99].includes(code ?? -1)) return 'storm';
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code ?? -1)) return 'wet';
  return 'unknown';
}
export function forecastDate(now: number, timezone = 'UTC'): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return new Date(now).toISOString().slice(0, 10); }
}
export const visibleForecastDays = (w: Weather, now: number) => (w.days ?? []).filter(day => day.date >= forecastDate(now, w.timezone));
