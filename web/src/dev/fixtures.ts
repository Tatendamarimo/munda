import type { ObservationItem } from '../data/repository';
import type { FieldRecord, HistoryReview, Observation, PossibleCause } from '../domain/models';
import { normalizeKey } from '../domain/models';

/**
 * Development-only sample farm (open the app with ?demo). Lets every screen be checked with
 * realistic data without the Firestore emulator. Never bundled in production builds.
 */
const DAY = 86_400_000;

/** Built on first use only, so production builds (where callers are dead code) drop all of it. */
let cached: ObservationItem[] | null = null;
export function demoObservations(): ObservationItem[] {
  return (cached ??= build(Date.now()));
}

function build(now: number): ObservationItem[] {

const nitrogen: PossibleCause = {
  guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'HIGH',
  supporting: ['Lower leaves yellow first', 'Yellowing runs from the tip down the middle'],
  againstOrMissing: ['No record of when fertilizer was applied'],
  checkNext: 'Compare with a row that was top-dressed this season.',
};
const waterlogging: PossibleCause = {
  guideId: 'waterlogging', name: 'Waterlogging', likelihood: 'MEDIUM',
  supporting: ['Heavy rain in the last two weeks'],
  againstOrMissing: ['Not only in the lowest part of the plot'],
  checkNext: 'Dig up one plant and check the roots for brown rot or a sour smell.',
};
const armyworm: PossibleCause = {
  guideId: 'fall_armyworm', name: 'Fall armyworm', likelihood: 'HIGH',
  supporting: ['Ragged holes in the leaves', 'Sawdust-like droppings in the funnel'],
  againstOrMissing: ['No caterpillar seen yet'],
  checkNext: 'Open the funnel of 20 plants in a W walk and count how many have caterpillars.',
};

const record = (causes: PossibleCause[], urgency: FieldRecord['urgency'], summary: string): FieldRecord => ({
  summary, symptoms: [], possibleCauses: causes, urgency,
  uncertaintyNote: 'Knowing when fertilizer was last applied would change this most.',
});

const review: HistoryReview = {
  summary: 'Yellowing on the low field has come back after each heavy rain and now covers more of the plot.',
  patterns: [
    { kind: 'WORSENING', summary: 'Affected area grew from patches to most of the field.', relatedIds: [], source: 'RULE' },
    { kind: 'WEATHER_LINKED', summary: 'Each record followed heavy rain.', relatedIds: [], source: 'RULE' },
    { kind: 'RECURRING_ON_PLOT', summary: 'Nitrogen deficiency suggested three times on this plot.', relatedIds: [], source: 'CLOUD_AI' },
  ],
  updatedCauses: [waterlogging, nitrogen],
  nextChecks: ['Check whether water drains from the low end after rain.', 'If it drains, ask your extension officer about top-dressing.'],
  reviewedAtMillis: now - DAY / 2, historyConsidered: 3,
};

const obs = (id: string, plot: string, daysAgo: number, o: Partial<Observation>): ObservationItem => (
  {
    synced: daysAgo > 0.5,
    observation: {
      id, orgId: 'demo', ownerUid: 'demo', crop: 'MAIZE', plot, plotKey: normalizeKey(plot), cropStage: 'LATE_GROWTH',
      description: 'The lower leaves are yellowing from the tip and the plants are small.',
      core: { area: 'PATCHES', rainfall: 'HEAVY', onset: 'THIS_WEEK' }, followUps: [], hadPhoto: true,
      record: record([nitrogen, waterlogging], 'SOON', 'Lower leaves yellowing from the tip in patches after heavy rain.'),
      origin: 'ON_DEVICE', createdAtMillis: now - daysAgo * DAY, reviewStatus: 'NOT_STARTED', review: null, recordError: null,
      ...o,
    },
  });

return [
  obs('d1', 'Low field', 0.2, { core: { area: 'MOST_OF_FIELD', rainfall: 'HEAVY', onset: 'THIS_WEEK' }, reviewStatus: 'DONE', review, origin: 'CLOUD' }),
  obs('d2', 'Home plot', 2, { core: { area: 'FEW_PLANTS', rainfall: 'LIGHT', onset: 'RECENT' }, description: 'Ragged holes in the leaves and sawdust in the funnel.', record: record([armyworm], 'URGENT', 'Holes and droppings in the funnel on a few plants.') }),
  obs('d3', 'Low field', 9, { core: { area: 'PATCHES', rainfall: 'HEAVY', onset: 'THIS_WEEK' } }),
  obs('d4', 'River plot', 12, { core: { area: 'FEW_PLANTS', rainfall: 'LIGHT', onset: 'LONGER' }, record: record([waterlogging], 'ROUTINE', 'A few pale plants near the river.') }),
  obs('d5', 'Low field', 24, { core: { area: 'LOW_SPOTS', rainfall: 'FLOODING', onset: 'ONE_TO_TWO_WEEKS' } }),
  obs('d6', 'Low field', 38, { core: { area: 'FEW_PLANTS', rainfall: 'LIGHT', onset: 'RECENT' }, record: null, origin: 'PENDING' }),
];
}

export const demoMode = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
