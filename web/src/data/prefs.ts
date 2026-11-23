import { Store } from './store';

/**
 * Things only this device needs: never written to Firestore (the security rules only allow the
 * observation fields both clients share).
 */
export interface Prefs {
  /** For the greeting ("Hello, Gogo"). */
  name: string;
  /** Typed by the farmer; shown in the header. No reverse geocoding. */
  place: string;
  extension: { name: string; phone: string } | null;
  /** Planting date per plotKey, for the crop's age. */
  plantedAt: Record<string, number>;
}

const KEY = 'munda.prefs';
const DEFAULTS: Prefs = { name: '', place: '', extension: null, plantedAt: {} };

function load(): Prefs {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      name: typeof p.name === 'string' ? p.name : '',
      place: typeof p.place === 'string' ? p.place : '',
      extension: p.extension && typeof p.extension.phone === 'string' ? { name: String(p.extension.name ?? ''), phone: p.extension.phone } : null,
      plantedAt: p.plantedAt && typeof p.plantedAt === 'object' ? p.plantedAt : {},
    };
  } catch {
    return DEFAULTS;
  }
}

export const prefs = new Store<Prefs>(load());

export function updatePrefs(patch: Partial<Prefs>) {
  const next = { ...prefs.value, ...patch };
  prefs.set(next);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }
}

const WEEK = 7 * 86_400_000;

export function cropWeeks(plantedAt: number | undefined, now: number): number | null {
  if (plantedAt === undefined || plantedAt > now) return null;
  return Math.floor((now - plantedAt) / WEEK);
}
