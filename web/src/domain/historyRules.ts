import { guideFor } from './guide';
import type { FieldRecord, Observation, Pattern } from './models';
import { AffectedArea, Rainfall } from './models';

export interface HistoryThresholds {
  /** Prior observations on the same plot sharing a likely cause before we call it recurring. */
  recurringThreshold: number;
  /** Distinct other plots with the same likely cause (recent) before we call it spreading. */
  spreadingPlotThreshold: number;
  spreadingWindowDays: number;
}

const DAY = 86_400_000;
const MAX_RELATED = 10;

/** Causes listed at MEDIUM or above count as "the same likely cause" between observations. */
const candidateIds = (r: FieldRecord): Set<string> =>
  new Set(r.possibleCauses.filter((c) => c.likelihood !== 'LOW' && c.guideId).map((c) => c.guideId as string));

/**
 * Deterministic history checks, run before the cloud model so key signals are reproducible and
 * explainable. Mirrors HistoryRules.kt on Android.
 */
export function evaluateHistory(target: Observation, plotHistoryAll: Observation[], farmHistoryAll: Observation[], t: HistoryThresholds): Pattern[] {
  const record = target.record;
  if (!record) return [];
  const guide = guideFor(target.crop);
  // Patterns only make sense within one crop.
  const plotHistory = plotHistoryAll.filter((o) => o.crop === target.crop);
  const farmHistory = farmHistoryAll.filter((o) => o.crop === target.crop);
  const out: Pattern[] = [];
  const targetCauses = candidateIds(record);
  const nameOf = (id: string) => guide.get(id)?.name ?? id;

  const priorOnPlot = plotHistory
    .filter((o) => o.id !== target.id && o.plotKey === target.plotKey && o.record && o.createdAtMillis <= target.createdAtMillis)
    .sort((a, b) => b.createdAtMillis - a.createdAtMillis);

  // 1. Recurring: the same likely cause keeps showing up on this plot.
  for (const cause of targetCauses) {
    const matches = priorOnPlot.filter((o) => candidateIds(o.record!).has(cause));
    if (matches.length >= t.recurringThreshold) {
      out.push({
        kind: 'RECURRING_ON_PLOT',
        summary:
          `${nameOf(cause)} has come up ${matches.length + 1} times on ${target.plot}. ` +
          `A repeating problem usually has a cause in the field itself (soil, drainage, or a pest that wasn't controlled).`,
        relatedIds: matches.map((o) => o.id).slice(0, MAX_RELATED),
        source: 'RULE',
      });
      break;
    }
  }

  // 2. Worsening: more of the plot is affected than at the last observation.
  const last = priorOnPlot[0];
  if (last) {
    const now = AffectedArea.extent(target.core.area);
    const before = AffectedArea.extent(last.core.area);
    if (now > 0 && before > 0 && now > before) {
      out.push({
        kind: 'WORSENING',
        summary: `Affected area grew from "${AffectedArea.label(last.core.area).toLowerCase()}" to "${AffectedArea.label(target.core.area).toLowerCase()}" since the last check.`,
        relatedIds: [last.id],
        source: 'RULE',
      });
    }
  }

  // 3. Spreading: other plots on the farm recently showed the same likely cause.
  const since = target.createdAtMillis - t.spreadingWindowDays * DAY;
  for (const cause of targetCauses) {
    const others = farmHistory.filter(
      (o) => o.id !== target.id && o.plotKey !== target.plotKey && o.createdAtMillis >= since && o.record && candidateIds(o.record).has(cause),
    );
    const plots = new Set(others.map((o) => o.plotKey));
    if (plots.size >= t.spreadingPlotThreshold) {
      out.push({
        kind: 'SPREADING',
        summary: `${nameOf(cause)} was also suspected on ${plots.size} other plot(s) in the last ${t.spreadingWindowDays} days.`,
        relatedIds: others.map((o) => o.id).slice(0, MAX_RELATED),
        source: 'RULE',
      });
      break;
    }
  }

  // 4. Weather-linked: symptoms on this plot repeatedly follow heavy rain.
  if (Rainfall.isHeavy(target.core.rainfall)) {
    const afterRain = priorOnPlot.filter((o) => Rainfall.isHeavy(o.core.rainfall));
    if (afterRain.length > 0) {
      out.push({
        kind: 'WEATHER_LINKED',
        summary:
          `Problems on ${target.plot} were also recorded after heavy rain before. ` +
          `That points towards drainage (waterlogging) or nutrients washed out of the soil (leaching).`,
        relatedIds: afterRain.map((o) => o.id).slice(0, MAX_RELATED),
        source: 'RULE',
      });
    }
  }
  return out;
}

/** Rule findings win; AI findings of the same kind are dropped to avoid duplicates. */
export function mergePatterns(rules: Pattern[], ai: Pattern[]): Pattern[] {
  const kinds = new Set(rules.map((p) => p.kind));
  return [...rules, ...ai.filter((p) => !kinds.has(p.kind))];
}
