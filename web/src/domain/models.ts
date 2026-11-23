/**
 * Core domain types, shared shape with the Android client (same Firestore schema and rules).
 * Pure TypeScript: no Firebase or DOM imports, so it's unit-tested under Node.
 *
 * Design rule: Munda never diagnoses. Every finding is a PossibleCause with a visible
 * likelihood, supporting evidence, what's missing or contradicts it, and a check to do next.
 */

/** Builds a string-literal enum with labels and a safe parser. */
function labelled<K extends string>(labels: Record<K, string>, fallback: K) {
  const keys = Object.keys(labels) as K[];
  return {
    values: keys,
    label: (k: K): string => labels[k],
    parse: (raw: unknown): K => (typeof raw === 'string' && (keys as string[]).includes(raw) ? (raw as K) : fallback),
    /** Case-insensitive parse for model output. */
    parseLoose: (raw: unknown): K => {
      if (typeof raw !== 'string') return fallback;
      const hit = keys.find((k) => k.toLowerCase() === raw.trim().toLowerCase());
      return hit ?? fallback;
    },
  };
}

export type Crop = 'MAIZE';
export const Crop = labelled<Crop>({ MAIZE: 'Maize' }, 'MAIZE');

export type CropStage = 'EMERGENCE' | 'EARLY_GROWTH' | 'LATE_GROWTH' | 'TASSELING' | 'GRAIN_FILL' | 'MATURITY' | 'UNKNOWN';
export const CropStage = labelled<CropStage>(
  {
    EMERGENCE: 'Emergence',
    EARLY_GROWTH: 'Early growth',
    LATE_GROWTH: 'Late growth',
    TASSELING: 'Tasseling / silking',
    GRAIN_FILL: 'Grain fill',
    MATURITY: 'Maturity',
    UNKNOWN: 'Not sure',
  },
  'UNKNOWN',
);

export type AffectedArea = 'FEW_PLANTS' | 'PATCHES' | 'LOW_SPOTS' | 'FIELD_EDGES' | 'MOST_OF_FIELD' | 'UNKNOWN';
export const AffectedArea = {
  ...labelled<AffectedArea>(
    {
      FEW_PLANTS: 'A few plants',
      PATCHES: 'Patches',
      LOW_SPOTS: 'Low-lying spots',
      FIELD_EDGES: 'Field edges',
      MOST_OF_FIELD: 'Most of the field',
      UNKNOWN: 'Not sure',
    },
    'UNKNOWN',
  ),
  /** Rough extent, for "getting worse" comparisons. 0 = unknown. */
  extent: (a: AffectedArea): number =>
    ({ FEW_PLANTS: 1, PATCHES: 2, LOW_SPOTS: 2, FIELD_EDGES: 2, MOST_OF_FIELD: 3, UNKNOWN: 0 })[a],
};

export type Rainfall = 'NONE' | 'LIGHT' | 'HEAVY' | 'FLOODING' | 'UNKNOWN';
export const Rainfall = {
  ...labelled<Rainfall>(
    { NONE: 'No rain', LIGHT: 'Light rain', HEAVY: 'Heavy rain', FLOODING: 'Standing water / flooding', UNKNOWN: 'Not sure' },
    'UNKNOWN',
  ),
  isHeavy: (r: Rainfall) => r === 'HEAVY' || r === 'FLOODING',
};

export type Onset = 'RECENT' | 'THIS_WEEK' | 'ONE_TO_TWO_WEEKS' | 'LONGER' | 'UNKNOWN';
export const Onset = labelled<Onset>(
  {
    RECENT: 'Today or yesterday',
    THIS_WEEK: 'This week',
    ONE_TO_TWO_WEEKS: '1–2 weeks ago',
    LONGER: 'More than 2 weeks ago',
    UNKNOWN: 'Not sure',
  },
  'UNKNOWN',
);

export interface CoreAnswers {
  area: AffectedArea;
  rainfall: Rainfall;
  onset: Onset;
}
export const emptyCore = (): CoreAnswers => ({ area: 'UNKNOWN', rainfall: 'UNKNOWN', onset: 'UNKNOWN' });

export interface FollowUpQuestion {
  text: string;
  options: string[];
}

export interface QA {
  question: string;
  answer: string;
}

export type Likelihood = 'LOW' | 'MEDIUM' | 'HIGH';
export const Likelihood = {
  ...labelled<Likelihood>({ LOW: 'Less likely', MEDIUM: 'Possible', HIGH: 'Likely' }, 'LOW'),
  rank: (l: Likelihood) => ({ LOW: 0, MEDIUM: 1, HIGH: 2 })[l],
};

export type Urgency = 'ROUTINE' | 'SOON' | 'URGENT';
export const Urgency = labelled<Urgency>({ ROUTINE: 'Monitor', SOON: 'Act this week', URGENT: 'Act now' }, 'SOON');

export interface PossibleCause {
  /** Id in the crop's guide when it matches an entry; null for causes outside the guide. */
  guideId: string | null;
  name: string;
  likelihood: Likelihood;
  supporting: string[];
  againstOrMissing: string[];
  checkNext: string;
}

export interface FieldRecord {
  summary: string;
  symptoms: string[];
  possibleCauses: PossibleCause[];
  urgency: Urgency;
  uncertaintyNote: string;
}

/** Where the record was actually generated; shown on every observation. */
export type InferenceOrigin = 'ON_DEVICE' | 'CLOUD' | 'PENDING';
export const InferenceOrigin = labelled<InferenceOrigin>({ ON_DEVICE: 'On this device', CLOUD: 'Cloud AI', PENDING: 'Waiting for signal' }, 'PENDING');

export type ReviewStatus = 'NOT_STARTED' | 'DONE' | 'FAILED';
export const ReviewStatus = labelled<ReviewStatus>({ NOT_STARTED: 'Not started', DONE: 'Done', FAILED: 'Failed' }, 'NOT_STARTED');

export type PatternKind = 'RECURRING_ON_PLOT' | 'SPREADING' | 'WORSENING' | 'WEATHER_LINKED' | 'OTHER';
export const PatternKind = labelled<PatternKind>(
  {
    RECURRING_ON_PLOT: 'Keeps coming back',
    SPREADING: 'Spreading to other plots',
    WORSENING: 'Getting worse',
    WEATHER_LINKED: 'Linked to rain',
    OTHER: 'Pattern',
  },
  'OTHER',
);

export type FindingSource = 'RULE' | 'CLOUD_AI';
export const FindingSource = labelled<FindingSource>({ RULE: 'From your records', CLOUD_AI: 'Cloud AI' }, 'RULE');

export interface Pattern {
  kind: PatternKind;
  summary: string;
  relatedIds: string[];
  source: FindingSource;
}

export interface HistoryReview {
  summary: string;
  patterns: Pattern[];
  updatedCauses: PossibleCause[];
  nextChecks: string[];
  reviewedAtMillis: number;
  historyConsidered: number;
}

export interface Observation {
  id: string;
  orgId: string;
  ownerUid: string;
  crop: Crop;
  /** As the farmer typed it, for display. */
  plot: string;
  /** Normalised, for history queries. */
  plotKey: string;
  cropStage: CropStage;
  description: string;
  core: CoreAnswers;
  followUps: QA[];
  hadPhoto: boolean;
  record: FieldRecord | null;
  origin: InferenceOrigin;
  createdAtMillis: number;
  reviewStatus: ReviewStatus;
  review: HistoryReview | null;
  recordError: string | null;
}

export const Limits = {
  MAX_KEY: 64,
  MAX_DESCRIPTION: 8000,
  MAX_ANSWER: 200,
} as const;

export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-').slice(0, Limits.MAX_KEY);
}
