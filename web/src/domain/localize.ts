import type { Lang } from '../i18n/langs';
import { guideTranslations, type GuideEntry, type SymptomGuide } from './guide';
import type { PossibleCause } from './models';

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

export interface CauseDisplay {
  name: string;
  /** The check shown in "Check before buying anything". */
  check: string;
  /** The model's own (English, on-device) check, shown under Details when the guide text replaced it. */
  modelCheck: string | null;
}

/**
 * What the farmer sees for a possible cause. Guide-backed causes take their name and field check
 * from the human-written guide in the farmer's language; in English the model's own check is
 * kept because it's specific to what the farmer described. Causes outside the guide stay as written.
 */
export function causeDisplay(cause: PossibleCause, lang: Lang, guide: SymptomGuide): CauseDisplay {
  const entry = guide.get(cause.guideId);
  if (!entry) return { name: cause.name, check: cause.checkNext, modelCheck: null };
  const loc = localizedEntry(entry, lang, guide.crop.toLowerCase());
  if (lang === 'en') return { name: loc.name, check: cause.checkNext || loc.checkInField, modelCheck: null };
  return { name: loc.name, check: loc.checkInField, modelCheck: cause.checkNext || null };
}
