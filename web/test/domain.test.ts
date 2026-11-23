import { describe, expect, it } from 'vitest';
import { guideFor } from '../src/domain/guide';
import { evaluateHistory, mergePatterns, type HistoryThresholds } from '../src/domain/historyRules';
import type { AffectedArea, CoreAnswers, CropStage, Likelihood, Observation, Pattern, Rainfall } from '../src/domain/models';
import { Crop, emptyCore } from '../src/domain/models';
import { DEFAULT_UNCERTAINTY, parseQuestions, parseRecord, parseReview } from '../src/domain/parser';
import { decideRoute } from '../src/domain/routing';

const maize = guideFor('MAIZE');

describe('routing policy', () => {
  const max = 6000;
  it('on device when model ready and note fits, even offline', () => {
    expect(decideRoute(500, 'AVAILABLE', false, max).route).toBe('ON_DEVICE');
    expect(decideRoute(500, 'AVAILABLE', true, max).route).toBe('ON_DEVICE');
    expect(decideRoute(max, 'AVAILABLE', false, max).route).toBe('ON_DEVICE');
  });
  it('long note goes to cloud online, queued offline (never truncated)', () => {
    expect(decideRoute(max + 1, 'AVAILABLE', true, max).route).toBe('CLOUD');
    expect(decideRoute(max + 1, 'AVAILABLE', false, max).route).toBe('QUEUE_UNTIL_ONLINE');
  });
  it('no local model: cloud online, queued offline', () => {
    expect(decideRoute(100, 'UNAVAILABLE', true, max).route).toBe('CLOUD');
    expect(decideRoute(100, 'DOWNLOADING', false, max).route).toBe('QUEUE_UNTIL_ONLINE');
  });
});

describe('maize guide retrieval (eval scenarios, mirrors docs/eval/scenarios.md)', () => {
  const core = (area: AffectedArea = 'UNKNOWN', rainfall: Rainfall = 'UNKNOWN'): CoreAnswers => ({ ...emptyCore(), area, rainfall });
  const scenarios: Array<{ name: string; text: string; core?: CoreAnswers; stage?: CropStage; must: string[] }> = [
    { name: 'Yellow lower leaves after heavy rain', text: 'The lower leaves are yellowing from the tip down the middle and the plants are not growing well', core: core('PATCHES', 'HEAVY'), must: ['nitrogen', 'waterlogging'] },
    { name: 'Yellowing in low spots', text: 'Maize is yellow and small in some places', core: core('LOW_SPOTS', 'FLOODING'), must: ['waterlogging', 'nitrogen'] },
    { name: 'Ragged holes and sawdust', text: 'There are ragged holes in the leaves and something like sawdust inside the funnel', must: ['fall_armyworm'] },
    { name: 'Leaf rolling in dry spell', text: 'Leaves are rolling and look grey in the afternoon', core: core('MOST_OF_FIELD', 'NONE'), must: ['drought'] },
    { name: 'Thin yellow streaks', text: 'Young leaves have thin broken yellow streaks along the lines and plants are stunted', core: core('FIELD_EDGES'), must: ['streak_virus'] },
    { name: 'Purple young plants', text: 'The young plants are purple on the edges and growing slowly', stage: 'EMERGENCE', must: ['phosphorus'] },
    { name: 'Burnt leaf edges', text: 'Older leaves have brown burnt edges but the middle is green', must: ['potassium'] },
    { name: 'Grey rectangular spots', text: 'Grey rectangular spots on the lower leaves, very humid this week', must: ['grey_leaf_spot'] },
    { name: 'Wilting with pink flowered weeds', text: 'Maize is wilting and yellow even though soil is wet, small weeds with pink flowers at the base', must: ['striga'] },
    { name: 'Yellow upper leaves', text: 'The new top leaves are pale yellow with stripes, bottom leaves look fine', must: ['sulfur'] },
  ];
  for (const s of scenarios) {
    it(s.name, () => {
      const got = maize.relevant(s.text, s.core ?? emptyCore(), s.stage ?? 'EARLY_GROWTH', 5).map((e) => e.id);
      for (const id of s.must) expect(got).toContain(id);
    });
  }
  it('word boundaries prevent false matches', () => {
    expect(maize.relevant('lower leaves yellowing', emptyCore(), 'UNKNOWN', 3)[0]?.id).toBe('nitrogen');
  });
  it('always returns alternatives', () => {
    expect(maize.relevant('', emptyCore(), 'UNKNOWN', 1).length).toBeGreaterThanOrEqual(3);
  });
});

describe('guides contract', () => {
  it('every crop has a complete guide', () => {
    for (const crop of Crop.values) {
      const g = guideFor(crop);
      expect(g.crop).toBe(crop);
      expect(g.entries.length).toBeGreaterThanOrEqual(5);
      expect(new Set(g.entries.map((e) => e.id)).size).toBe(g.entries.length);
      for (const e of g.entries) {
        expect(e.id).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(e.keywords.length).toBeGreaterThan(0);
        expect(e.keywords.every((k) => k === k.toLowerCase())).toBe(true);
        expect(e.signs && e.distinguish && e.checkInField).toBeTruthy();
      }
    }
  });
});

describe('model output parser', () => {
  const allowed = new Set(['nitrogen', 'waterlogging', 'sulfur']);

  it('parses fenced record and enforces one Likely cause', () => {
    const raw = '```json\n{"summary":"Lower leaves yellowing in patches after heavy rain","symptoms":["yellow lower leaves","stunting"],' +
      '"possibleCauses":[{"guideId":"nitrogen","name":"Nitrogen deficiency","likelihood":"HIGH","supporting":["lower leaves first","V-shaped yellowing"],"againstOrMissing":["no fertilizer record"],"checkNext":"Compare with a fertilized row"},' +
      '{"guideId":"waterlogging","name":"Waterlogging","likelihood":"HIGH","supporting":["heavy rain","patches"],"againstOrMissing":[],"checkNext":"Check roots"}],' +
      '"urgency":"soon","uncertaintyNote":""}\n```';
    const r = parseRecord(raw, maize, allowed);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.possibleCauses.map((c) => c.likelihood)).toEqual(['HIGH', 'MEDIUM']);
    expect(r.value.urgency).toBe('SOON');
    expect(r.value.uncertaintyNote).toBe(DEFAULT_UNCERTAINTY);
  });

  it('Likely needs at least two supporting observations', () => {
    const r = parseRecord('{"summary":"x","possibleCauses":[{"guideId":"sulfur","likelihood":"HIGH","supporting":["one thing"],"checkNext":"look"}]}', maize, allowed);
    expect(r.ok && r.value.possibleCauses[0]?.likelihood).toBe('MEDIUM');
  });

  it('unknown guide ids dropped but cause kept by name; missing check falls back to guide', () => {
    const r = parseRecord(
      '{"summary":"x","possibleCauses":[{"guideId":"made_up","name":"Something else","likelihood":"LOW","supporting":[],"checkNext":"Ask an extension officer"},{"guideId":"nitrogen","likelihood":"MEDIUM","supporting":["pale"]}]}',
      maize,
      allowed,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.possibleCauses.find((c) => c.name === 'Something else')?.guideId).toBeNull();
    const n = r.value.possibleCauses.find((c) => c.guideId === 'nitrogen');
    expect(n?.name).toBe('Nitrogen deficiency');
    expect(n?.checkNext.length).toBeGreaterThan(0);
  });

  it('record without causes or summary fails', () => {
    expect(parseRecord('{"summary":"x","possibleCauses":[]}', maize, allowed).ok).toBe(false);
    expect(parseRecord('{"possibleCauses":[]}', maize, allowed).ok).toBe(false);
    expect(parseRecord('not json', maize, allowed).ok).toBe(false);
    expect(parseRecord(null, maize, allowed).ok).toBe(false);
  });

  it('questions get a Not sure option and are capped', () => {
    const r = parseQuestions(
      '{"questions":[{"text":"Are the yellow leaves at the bottom or the top of the plant?","options":["Bottom","Top","Both"]},{"text":"Did you apply fertilizer this season?","options":[]},{"text":"Third question that should be dropped?","options":["a","b"]}]}',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
    expect(r.value[0]?.options).toEqual(['Bottom', 'Top', 'Both', 'Not sure']);
    expect(r.value[1]?.options).toEqual(['Yes', 'No', 'Not sure']);
  });

  it('review drops hallucinated history references', () => {
    const r = parseReview('{"summary":"s","patterns":[{"kind":"WEATHER_LINKED","summary":"after rain","relatedIds":["a","ghost"]}],"updatedCauses":[],"nextChecks":["Dig a root"]}', new Set(['a']), maize);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.patterns[0]?.relatedIds).toEqual(['a']);
    expect(r.value.nextChecks).toEqual(['Dig a root']);
  });
});

describe('history rules', () => {
  const t: HistoryThresholds = { recurringThreshold: 1, spreadingPlotThreshold: 2, spreadingWindowDays: 14 };
  const day = 86_400_000;
  const obs = (id: string, o: { plot?: string; daysAgo?: number; cause?: string; likelihood?: Likelihood; area?: AffectedArea; rain?: Rainfall } = {}): Observation => ({
    id, orgId: 'demo', ownerUid: 'u', crop: 'MAIZE', plot: o.plot ?? 'NORTH', plotKey: o.plot ?? 'NORTH', cropStage: 'EARLY_GROWTH',
    description: '', core: { area: o.area ?? 'PATCHES', rainfall: o.rain ?? 'LIGHT', onset: 'UNKNOWN' }, followUps: [], hadPhoto: false,
    record: { summary: 's', symptoms: [], possibleCauses: [{ guideId: o.cause ?? 'nitrogen', name: 'n', likelihood: o.likelihood ?? 'MEDIUM', supporting: [], againstOrMissing: [], checkNext: 'c' }], urgency: 'SOON', uncertaintyNote: '' },
    origin: 'ON_DEVICE', createdAtMillis: 100 * day - (o.daysAgo ?? 0) * day, reviewStatus: 'NOT_STARTED', review: null, recordError: null,
  });
  const kinds = (p: Pattern[]) => new Set(p.map((x) => x.kind));

  it('recurring when same cause seen before on plot, ignores LOW', () => {
    expect(kinds(evaluateHistory(obs('t'), [obs('a', { daysAgo: 20 })], [], t)).has('RECURRING_ON_PLOT')).toBe(true);
    expect(kinds(evaluateHistory(obs('t'), [obs('a', { daysAgo: 20, likelihood: 'LOW' })], [], t)).has('RECURRING_ON_PLOT')).toBe(false);
  });
  it('worsening compares with most recent prior on plot', () => {
    const p = evaluateHistory(obs('t', { area: 'MOST_OF_FIELD' }), [obs('old', { daysAgo: 30, area: 'MOST_OF_FIELD' }), obs('recent', { daysAgo: 5, area: 'FEW_PLANTS' })], [], t);
    expect(p.find((x) => x.kind === 'WORSENING')?.relatedIds).toEqual(['recent']);
  });
  it('spreading needs distinct other plots within window', () => {
    const farm = [obs('a', { plot: 'EAST', daysAgo: 3 }), obs('b', { plot: 'EAST', daysAgo: 4 })];
    expect(kinds(evaluateHistory(obs('t'), [], farm, t)).has('SPREADING')).toBe(false);
    const farm2 = [...farm, obs('c', { plot: 'SOUTH', daysAgo: 2 }), obs('old', { plot: 'WEST', daysAgo: 40 })];
    const s = evaluateHistory(obs('t'), [], farm2, t).find((x) => x.kind === 'SPREADING');
    expect(s).toBeDefined();
    expect(s?.relatedIds).not.toContain('old');
  });
  it('weather linked when symptoms repeatedly follow heavy rain', () => {
    expect(kinds(evaluateHistory(obs('t', { rain: 'HEAVY' }), [obs('a', { daysAgo: 30, rain: 'FLOODING', cause: 'waterlogging' })], [], t)).has('WEATHER_LINKED')).toBe(true);
  });
  it('no record means no patterns', () => {
    expect(evaluateHistory({ ...obs('t'), record: null }, [obs('a', { daysAgo: 3 })], [], t)).toEqual([]);
  });
  it('merge keeps rule findings over AI duplicates', () => {
    const rule: Pattern = { kind: 'WORSENING', summary: 'r', relatedIds: [], source: 'RULE' };
    const merged = mergePatterns([rule], [{ ...rule, summary: 'dup', source: 'CLOUD_AI' }, { kind: 'OTHER', summary: 'new', relatedIds: [], source: 'CLOUD_AI' }]);
    expect(merged.map((p) => p.summary)).toEqual(['r', 'new']);
  });
});
