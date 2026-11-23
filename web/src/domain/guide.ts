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

  constructor(entries: GuideEntry[]) {
    for (const e of entries) {
      this.patterns.set(
        e.id,
        e.keywords.map((k) => [k, new RegExp(`(^|[^a-z])${escapeRegExp(k)}(s|es|ed|ing)?($|[^a-z])`)]),
      );
    }
  }

  score(entry: GuideEntry, text: string): number {
    const t = text.toLowerCase().replace(/[^a-z0-9 \-]/g, ' ');
    let score = 0;
    for (const [phrase, rx] of this.patterns.get(entry.id) ?? []) {
      if (rx.test(t)) score += phrase.includes(' ') ? 2 : 1;
    }
    return score;
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MIN_RESULTS = 3;

function maizeGuide(): SymptomGuide {
  const entries = maizeJson.entries as GuideEntry[];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index = new KeywordIndex(entries);

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
