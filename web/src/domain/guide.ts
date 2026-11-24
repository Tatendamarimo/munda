import maizeJson from '../../../shared/guides/maize.json';
import type { CoreAnswers, Crop, CropStage } from './models';
import { Rainfall } from './models';

export type GuideCategory = 'NUTRIENT' | 'WATER' | 'PEST' | 'DISEASE' | 'WEED';

/** One problem the assistant may suggest: reference material for the model, not a diagnosis tool. */
export interface GuideEntry {
  id: string;
  name: string;
  category: GuideCategory;
  /** Lower-case words/phrases a farmer might use. Used for on-device retrieval. */
  keywords: string[];
  signs: string;
  /** What separates this from look-alikes; used to generate discriminating questions. */
  distinguish: string;
  checkInField: string;
  /** What it looks like at different crop stages. */
  byStage?: string;
  /** Season, weather, soil or practice that makes it likely. */
  likelyWhen?: string;
  /** What a farmer can do now, without product names or doses. */
  actNow?: string;
  /** What to do before and during next season. */
  prevent?: string;
  /** Must be reported to the authorities (e.g. MLN, not yet in southern Africa). */
  report?: boolean;
  /** What the entry was written from. */
  sources?: { title: string; url: string }[];
}

/**
 * Extension seam: each crop has its own guide (later, each livestock species). Prompts,
 * retrieval, parsing and history rules all go through guideFor(), so adding a crop means adding
 * a guide file and a Crop value. See docs/adr/0004-multi-crop-and-livestock.md.
 */
export interface SymptomGuide {
  crop: Crop;
  entries: GuideEntry[];
  get(id: string | null | undefined): GuideEntry | undefined;
  /** Top entries for this observation; always several, so the model weighs alternatives. */
  relevant(text: string, core: CoreAnswers, stage: CropStage, limit?: number): GuideEntry[];
}

/**
 * Word-boundary keyword matching with simple inflections: "low" doesn't match "lower leaves",
 * but "yellow" matches "yellowing". Multi-word phrases weigh more because they're more specific.
 */
export class KeywordIndex {
  private readonly patterns = new Map<string, Array<[string, RegExp]>>();

  /** extraKeywords: entry id → keywords in other languages, matched the same way as English ones. */
  constructor(entries: GuideEntry[], extraKeywords: ReadonlyMap<string, readonly string[]> = new Map()) {
    for (const e of entries) {
      const all = [...new Set([...e.keywords, ...(extraKeywords.get(e.id) ?? [])].map(normalizeText).filter((k) => k !== ''))];
      this.patterns.set(
        e.id,
        all.map((k) => [k, new RegExp(`(^|[^a-z])${escapeRegExp(k)}(s|es|ed|ing)?($|[^a-z])`)]),
      );
    }
  }

  score(entry: GuideEntry, text: string): number {
    const t = normalizeText(text);
    let score = 0;
    for (const [phrase, rx] of this.patterns.get(entry.id) ?? []) {
      if (rx.test(t)) score += phrase.includes(' ') ? 2 : 1;
    }
    return score;
  }
}

/**
 * Lower-case, strip accents (NFD + drop combining marks) and keep only a-z, digits, spaces and
 * hyphens, so "Hojas AMARILLAS" and "maïs" match keywords written without accents.
 */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 \-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MIN_RESULTS = 3;

/** Translated guide side files: shared/guides/i18n/<crop>.<lang>.json (the English guide stays untouched). */
export interface GuideTranslation {
  lang: string;
  entries: Array<{ id: string; name?: string; signs?: string; checkInField?: string; keywords?: string[] }>;
}

const translationFiles = import.meta.glob<GuideTranslation>('../../../shared/guides/i18n/*.json', { eager: true, import: 'default' });

/** All translations for a crop, keyed by language code. */
export function guideTranslations(crop: string): Map<string, GuideTranslation> {
  const out = new Map<string, GuideTranslation>();
  for (const [path, t] of Object.entries(translationFiles)) {
    const m = /\/([a-z_]+)\.([a-z]{2,3})\.json$/.exec(path);
    if (m && m[1] === crop) out.set(m[2]!, t);
  }
  return out;
}

/** Keywords from every language merged per entry, so a description in any language finds its entries. */
function translatedKeywords(crop: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of guideTranslations(crop).values()) {
    for (const e of t.entries) out.set(e.id, [...(out.get(e.id) ?? []), ...(e.keywords ?? [])]);
  }
  return out;
}

function maizeGuide(): SymptomGuide {
  const entries = maizeJson.entries as GuideEntry[];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index = new KeywordIndex(entries, translatedKeywords('maize'));

  return {
    crop: 'MAIZE',
    entries,
    get: (id) => (id ? byId.get(id) : undefined),
    relevant(text, core, stage, limit = 5) {
      const scored = entries.map((e) => {
        let s = index.score(e, text);
        // Maize-specific context boosts from the core answers.
        switch (e.id) {
          case 'waterlogging':
            if (Rainfall.isHeavy(core.rainfall)) s += 2;
            if (core.area === 'LOW_SPOTS') s += 3;
            break;
          case 'nitrogen':
            if (Rainfall.isHeavy(core.rainfall)) s += 1; // leaching
            break;
          case 'drought':
            if (core.rainfall === 'NONE') s += 3;
            else if (Rainfall.isHeavy(core.rainfall)) s -= 2;
            break;
          case 'streak_virus':
            if (core.area === 'FIELD_EDGES' || core.area === 'FEW_PLANTS') s += 0.5;
            break;
          case 'phosphorus':
            if (stage === 'EMERGENCE' || stage === 'EARLY_GROWTH') s += 0.5;
            break;
          case 'fall_armyworm':
            if (stage === 'EARLY_GROWTH' || stage === 'LATE_GROWTH') s += 0.5;
            break;
        }
        return { e, s };
      });
      // Stable sort: ties keep guide order, matching the Android client.
      return scored
        .map((x, i) => ({ ...x, i }))
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .slice(0, Math.max(limit, MIN_RESULTS))
        .map((x) => x.e);
    },
  };
}

const guides: Record<Crop, SymptomGuide> = { MAIZE: maizeGuide() };

export const guideFor = (crop: Crop): SymptomGuide => guides[crop];
