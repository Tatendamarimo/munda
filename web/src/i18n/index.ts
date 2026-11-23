import { useCallback } from 'react';
import { Store, useStore } from '../data/store';
import type { AffectedArea, CropStage, FindingSource, InferenceOrigin, Likelihood, Onset, PatternKind, Rainfall, Urgency } from '../domain/models';
import { en, type MessageKey, type PartialMessages } from './en';
import { isLang, LANGS, type Lang } from './langs';
import { sn } from './sn';

export { LANGS, LANG_CODES, isLang, type Lang } from './langs';
export type { MessageKey } from './en';

/** Languages without a dictionary yet simply fall back to English for every key. */
const DICTS: Partial<Record<Lang, PartialMessages>> = { en, sn };

export function registerDictionary(lang: Lang, dict: PartialMessages) {
  DICTS[lang] = dict;
}

const lookup = (dict: object | undefined, key: string): string | undefined => {
  let x: unknown = dict;
  for (const k of key.split('.')) x = x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined;
  return typeof x === 'string' && x.trim() !== '' ? x : undefined;
};

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m)) : raw;
}

export function pickInitialLang(navLangs: readonly string[]): Lang {
  for (const l of navLangs) {
    const primary = l.toLowerCase().split('-')[0];
    if (isLang(primary)) return primary;
  }
  return 'en';
}

const STORAGE_KEY = 'munda.lang';
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage unavailable */ }
  return typeof navigator === 'undefined' ? 'en' : pickInitialLang(navigator.languages ?? [navigator.language]);
}

export const language = new Store<Lang>(typeof window === 'undefined' ? 'en' : initialLang());

export function setLanguage(l: Lang) {
  language.set(l);
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* best effort */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export const useLang = (): Lang => useStore(language);

export function useT() {
  const lang = useLang();
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** Locale for Intl, falling back to English when the runtime doesn't know it (e.g. some sn/nd builds). */
function intlLocale(lang: Lang): string {
  const loc = LANGS[lang].locale;
  try { return Intl.DateTimeFormat.supportedLocalesOf([loc]).length ? loc : 'en'; } catch { return 'en'; }
}

export function formatDate(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleDateString(intlLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleDateString(intlLocale(lang), { day: 'numeric', month: 'short' });
}

export function weekday(day: number, lang: Lang): string {
  // 2023-01-01 was a Sunday (day 0).
  return new Date(Date.UTC(2023, 0, 1 + day, 12)).toLocaleDateString(intlLocale(lang), { weekday: 'long', timeZone: 'UTC' });
}

export function relativeTime(ms: number, now: number, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto', style: 'short' });
  const min = -Math.round((now - ms) / 60_000);
  if (Math.abs(min) < 60) return rtf.format(min, 'minute');
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, 'hour');
  const d = Math.round(h / 24);
  if (Math.abs(d) < 7) return rtf.format(d, 'day');
  return shortDate(ms, lang);
}

export const labelArea = (a: AffectedArea, l: Lang) => translate(l, `enums.area.${a}`);
export const labelRain = (r: Rainfall, l: Lang) => translate(l, `enums.rain.${r}`);
export const labelOnset = (o: Onset, l: Lang) => translate(l, `enums.onset.${o}`);
export const labelStage = (s: CropStage, l: Lang) => translate(l, `enums.stage.${s}`);
export const labelLikelihood = (x: Likelihood, l: Lang) => translate(l, `enums.likelihood.${x}`);
export const labelUrgency = (u: Urgency, l: Lang) => translate(l, `enums.urgency.${u}`);
export const labelOrigin = (o: InferenceOrigin, l: Lang) => translate(l, `enums.origin.${o}`);
export const labelPattern = (p: PatternKind, l: Lang) => translate(l, `enums.pattern.${p}`);
export const labelSource = (s: FindingSource, l: Lang) => translate(l, `enums.source.${s}`);
