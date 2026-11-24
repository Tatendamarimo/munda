import { connectivity } from './connectivity';
import { prefs } from './prefs';
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

/** First match from Open-Meteo's place search, with "Name, Country" so the farmer can see what matched. */
export function parseGeocode(json: unknown): Coords | null {
  const r = (json as { results?: unknown } | null)?.results;
  const first = Array.isArray(r) ? (r[0] as { latitude?: unknown; longitude?: unknown; name?: unknown; country?: unknown } | undefined) : undefined;
  const latitude = num(first?.latitude);
  const longitude = num(first?.longitude);
  if (latitude === null || longitude === null) return null;
  const label = [first?.name, first?.country].filter((x): x is string => typeof x === 'string' && x !== '').join(', ');
  return { latitude, longitude, label };
}

/** Set when the typed area couldn't be found, so Me can say so instead of showing nothing. */
export const placeNotFound = new Store<string | null>(null);

async function geocode(place: string): Promise<Coords | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`);
  return res.ok ? parseGeocode(await res.json()) : null;
}

const position = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 6 * 3_600_000, timeout: 15_000 }),
  );

export async function refreshWeather(force = false): Promise<void> {
  if (!weatherEnabled.value || !connectivity.value) return;
  const cached = weather.value;
  if (!force && cached && Date.now() - cached.at < MAX_AGE) return;
  try {
    // Device location first; if it's blocked or unavailable, the area typed on Me (e.g. "Hwedza").
    const located = 'geolocation' in navigator ? await position().then((p) => p.coords, () => null) : null;
    const place = prefs.value.place.trim();
    const found = located ? null : place ? await geocode(place) : null;
    placeNotFound.set(!located && place && !found ? place : null);
    // A forecast for a previously typed place no longer applies.
    if (!located && place && !found) { weather.set(null); try { localStorage.removeItem(CACHE); } catch { /* best effort */ } }
    const coords = located ?? found;
    if (!coords) return;
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
