import { describe, expect, it } from 'vitest';
import { farmSummary, latestAlert, plotsFrom, timeline } from '../src/domain/farm';
import type { FieldRecord, HistoryReview, Observation, Pattern, Urgency } from '../src/domain/models';
import { emptyCore, normalizeKey } from '../src/domain/models';

let n = 0;
function obs(p: Partial<Observation> & { plot?: string; urgency?: Urgency; patterns?: Pattern[] } = {}): Observation {
  const plot = p.plot ?? 'River plot';
  const record: FieldRecord | null = p.urgency
    ? { summary: 's', symptoms: [], possibleCauses: [], urgency: p.urgency, uncertaintyNote: 'u' }
    : null;
  const review: HistoryReview | null = p.patterns
    ? { summary: 'r', patterns: p.patterns, updatedCauses: [], nextChecks: [], reviewedAtMillis: 0, historyConsidered: 1 }
    : null;
  n += 1;
  return {
    id: `o${n}`, orgId: 'demo', ownerUid: 'u', crop: 'MAIZE', plot, plotKey: normalizeKey(plot), cropStage: 'EARLY_GROWTH',
    description: 'd', core: emptyCore(), followUps: [], hadPhoto: false, record, origin: 'ON_DEVICE',
    createdAtMillis: p.createdAtMillis ?? n * 1000, reviewStatus: review ? 'DONE' : 'NOT_STARTED', review, recordError: null,
    ...(p.core ? { core: p.core } : {}),
  };
}
const pattern = (kind: Pattern['kind']): Pattern => ({ kind, summary: kind, relatedIds: [], source: 'RULE' });

describe('plots from observations', () => {
  it('groups by plotKey and shows the newest spelling', () => {
    const plots = plotsFrom([obs({ plot: 'river plot ', createdAtMillis: 1 }), obs({ plot: 'River plot', createdAtMillis: 2 })]);
    expect(plots).toHaveLength(1);
    expect(plots[0]).toMatchObject({ count: 2, name: 'River plot', lastAt: 2 });
  });

  it('sorts plots by most recent activity', () => {
    const plots = plotsFrom([obs({ plot: 'A', createdAtMillis: 5 }), obs({ plot: 'B', createdAtMillis: 9 })]);
    expect(plots.map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('derives status from the latest urgency and review patterns', () => {
    const status = (o: Observation) => plotsFrom([o])[0]!.status;
    expect(status(obs({ urgency: 'SOON' }))).toBe('WATCH');
    expect(status(obs({ urgency: 'URGENT' }))).toBe('ACT');
    expect(status(obs({ urgency: 'ROUTINE' }))).toBe('OK');
    expect(status(obs({ urgency: 'ROUTINE', patterns: [pattern('WORSENING')] }))).toBe('WATCH');
    expect(status(obs({ urgency: 'ROUTINE', patterns: [pattern('SPREADING')] }))).toBe('WATCH');
    expect(status(obs())).toBe('OK');
  });

  it('handles no observations', () => {
    expect(plotsFrom([])).toEqual([]);
    expect(farmSummary([])).toEqual({ plots: 0, needsCheck: 0 });
    expect(latestAlert([])).toBeNull();
  });

  it('counts plots needing a check', () => {
    const plots = plotsFrom([obs({ plot: 'A', urgency: 'SOON' }), obs({ plot: 'B', urgency: 'URGENT' }), obs({ plot: 'C', urgency: 'ROUTINE' })]);
    expect(farmSummary(plots)).toEqual({ plots: 3, needsCheck: 2 });
  });
});

describe('timeline and alerts', () => {
  it('orders a plot timeline oldest first and marks heavy rain', () => {
    const t = timeline([
      obs({ plot: 'A', createdAtMillis: 30, core: { area: 'MOST_OF_FIELD', rainfall: 'FLOODING', onset: 'UNKNOWN' } }),
      obs({ plot: 'A', createdAtMillis: 10, core: { area: 'FEW_PLANTS', rainfall: 'LIGHT', onset: 'UNKNOWN' } }),
      obs({ plot: 'B', createdAtMillis: 20 }),
      obs({ plot: 'A', createdAtMillis: 20, core: { area: 'PATCHES', rainfall: 'HEAVY', onset: 'UNKNOWN' } }),
    ], normalizeKey('A'));
    expect(t.map((p) => p.at)).toEqual([10, 20, 30]);
    expect(t.map((p) => p.extent)).toEqual([1, 2, 3]);
    expect(t.map((p) => p.heavyRain)).toEqual([false, true, true]);
  });

  it('alerts from the newest observation with patterns', () => {
    const older = obs({ createdAtMillis: 1, patterns: [pattern('RECURRING_ON_PLOT')] });
    const newer = obs({ createdAtMillis: 2, patterns: [pattern('WORSENING'), pattern('WEATHER_LINKED')] });
    const none = obs({ createdAtMillis: 3 });
    const a = latestAlert([older, none, newer]);
    expect(a?.observation.id).toBe(newer.id);
    expect(a?.pattern.kind).toBe('WORSENING');
  });
});
