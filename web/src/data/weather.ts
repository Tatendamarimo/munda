import { connectivity } from './connectivity';
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

const position = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 6 * 3_600_000, timeout: 15_000 }),
  );

export async function refreshWeather(force = false): Promise<void> {
  if (!weatherEnabled.value || !connectivity.value || !('geolocation' in navigator)) return;
  const cached = weather.value;
  if (!force && cached && Date.now() - cached.at < MAX_AGE) return;
  try {
    const { coords } = await position();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}`
      + '&current=temperature_2m&daily=precipitation_sum&forecast_days=3&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return;
    const w = parseOpenMeteo(await res.json(), Date.now());
    if (!w) return;
    weather.set(w);
    localStorage.setItem(CACHE, JSON.stringify(w));
  } catch {
    /* declined, offline or API down: keep whatever we had */
  }
}
