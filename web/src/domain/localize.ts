import type { Lang } from '../i18n/langs';
import { guideTranslations, type GuideEntry } from './guide';

export interface LocalizedEntry {
  name: string;
  signs: string;
  checkInField: string;
}

const byLang = new Map<string, Map<string, { name?: string; signs?: string; checkInField?: string }>>();
function translationFor(crop: string, lang: Lang) {
  const key = `${crop}.${lang}`;
  let m = byLang.get(key);
  if (!m) {
    const t = guideTranslations(crop).get(lang);
    m = new Map((t?.entries ?? []).map((e) => [e.id, e]));
    byLang.set(key, m);
  }
  return m;
}

const pick = (x: string | undefined, fallback: string) => (x && x.trim() !== '' ? x : fallback);

/**
 * The human-written guide text for an entry in the farmer's language, field by field, falling back
 * to English. This (not AI translation) is what Munda shows as cause names and field checks.
 */
export function localizedEntry(entry: GuideEntry, lang: Lang, crop = 'maize'): LocalizedEntry {
  const t = lang === 'en' ? undefined : translationFor(crop, lang).get(entry.id);
  return {
    name: pick(t?.name, entry.name),
    signs: pick(t?.signs, entry.signs),
    checkInField: pick(t?.checkInField, entry.checkInField),
  };
}
