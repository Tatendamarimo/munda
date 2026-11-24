import { CALENDARS } from './calendar';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { LANG_CODES, LANGS, type Lang } from './langs';
import { nd } from './nd';
import { pt } from './pt';
import { sn } from './sn';
import { sw } from './sw';

const DICTS: Record<Lang, unknown> = { en, sn, nd, sw, fr, pt, es };

/** Flattens a nested dictionary to "section.key" → text. */
export function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof obj === 'string') out[prefix] = obj;
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/**
 * The files Android reads from shared/i18n: one per language (flat keys, sorted, plus calendar
 * names for sn/nd) and langs.json. Deterministic so a test can check the committed copy is current.
 */
export function exportI18n(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const lang of LANG_CODES) {
    const flat = flatten(DICTS[lang]);
    const cal = CALENDARS[lang];
    const body: Record<string, unknown> = { strings: Object.fromEntries(Object.keys(flat).sort().map((k) => [k, flat[k]])) };
    if (cal) body.calendar = cal;
    files[`${lang}.json`] = JSON.stringify(body, null, 1) + '\n';
  }
  files['langs.json'] = JSON.stringify(LANG_CODES.map((code) => ({ code, ...LANGS[code] })), null, 1) + '\n';
  return files;
}
