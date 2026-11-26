import { selectedDeviceArea } from './deviceArea';
import { connectivity } from './connectivity';
import { prefs } from './prefs';
import { coarseCell } from '../domain/groups';
import { Store } from './store';

/**
 * Optional rain outlook for the home header, from Open-Meteo (free, no key). Only runs when the
 * farmer switched it on, and only online. Any failure keeps the last cached forecast, or nothing:
 * the header simply leaves weather out.
 */
export interface Weather {
  tempC: number;
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
  return { tempC: Math.round(temp), rainSoon: rainDay !== null, rainDay, rainAt, at: now };
}

const SHOW_FOR = 24 * 3_600_000;

/**
 * What the header may show now: nothing once the forecast is over a day old (offline for days
 * must not read as this week's weather), and no rain once its day has passed.
 */
export function freshWeather(w: Weather | null, now: number): Weather | null {
  if (!w || now - w.at > SHOW_FOR) return null;
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
  else weather.set(null);
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

async function geocode(place: string): Promise<Coords | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=10&name=${encodeURIComponent(place)}`);
  return res.ok ? parseGeocode(await res.json()) : null;
}

export async function refreshWeather(force = false): Promise<void> {
  if (!weatherEnabled.value || !connectivity.value) return;
  const cached = weather.value;
  if (!force && cached && Date.now() - cached.at < MAX_AGE) return;
  try {
    // Use only an explicitly selected approximate area; never trigger GPS in a background refresh.
    const located = selectedDeviceArea();
    const place = prefs.value.place.trim();
    const found = located ? null : place ? await geocode(place) : null;
    placeNotFound.set(!located && place && !found ? place : null);
    // A forecast for a previously typed place no longer applies.
    if (!located && place && !found) { weather.set(null); try { localStorage.removeItem(CACHE); } catch { /* best effort */ } }
    const coords = located ?? found;
    if (!coords) return;
    const cell = coarseCell(coords.latitude, coords.longitude);
    placeCell.set(cell);
    try { localStorage.setItem(CELL, cell); } catch { /* best effort */ }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}`
      + '&current=temperature_2m&daily=precipitation_sum&forecast_days=3&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return;
    const parsed = parseOpenMeteo(await res.json(), Date.now());
    if (!parsed) return;
    const w = { ...parsed, where: found?.label ?? null };
    weather.set(w);
    localStorage.setItem(CACHE, JSON.stringify(w));
  } catch {
    /* declined, offline or API down: keep whatever we had */
  }
}
