import type { Observation, Pattern } from './models';
import { AffectedArea, Rainfall } from './models';

/**
 * Farm-level views derived from existing observations: no new Firestore fields or collections.
 * Pure, so the home screen and plot pages are unit-tested without Firebase.
 */

export type PlotStatus = 'OK' | 'WATCH' | 'ACT';

export interface PlotSummary {
  key: string;
  /** As the farmer typed it most recently. */
  name: string;
  status: PlotStatus;
  lastAt: number;
  count: number;
  latest: Observation;
}

const RAISING: ReadonlySet<Pattern['kind']> = new Set(['WORSENING', 'SPREADING']);

function statusOf(o: Observation): PlotStatus {
  const u = o.record?.urgency;
  if (u === 'URGENT') return 'ACT';
  if (u === 'SOON') return 'WATCH';
  return o.review?.patterns.some((p) => RAISING.has(p.kind)) ? 'WATCH' : 'OK';
}

export function plotsFrom(observations: Observation[]): PlotSummary[] {
  const byKey = new Map<string, Observation[]>();
  for (const o of observations) byKey.set(o.plotKey, [...(byKey.get(o.plotKey) ?? []), o]);
  return [...byKey.entries()]
    .map(([key, list]) => {
      const latest = list.reduce((a, b) => (b.createdAtMillis > a.createdAtMillis ? b : a));
      return { key, name: latest.plot.trim(), status: statusOf(latest), lastAt: latest.createdAtMillis, count: list.length, latest };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export interface TimelinePoint {
  id: string;
  at: number;
  /** AffectedArea.extent: 0 unknown, 1 few plants, 2 patches, 3 most of the field. */
  extent: number;
  heavyRain: boolean;
}

export function timeline(observations: Observation[], plotKey: string): TimelinePoint[] {
  return observations
    .filter((o) => o.plotKey === plotKey)
    .sort((a, b) => a.createdAtMillis - b.createdAtMillis)
    .map((o) => ({ id: o.id, at: o.createdAtMillis, extent: AffectedArea.extent(o.core.area), heavyRain: Rainfall.isHeavy(o.core.rainfall) }));
}

export function farmSummary(plots: PlotSummary[]): { plots: number; needsCheck: number } {
  return { plots: plots.length, needsCheck: plots.filter((p) => p.status !== 'OK').length };
}

export function latestAlert(observations: Observation[]): { observation: Observation; pattern: Pattern } | null {
  let best: Observation | null = null;
  for (const o of observations) {
    if (o.review?.patterns.length && (!best || o.createdAtMillis > best.createdAtMillis)) best = o;
  }
  return best ? { observation: best, pattern: best.review!.patterns[0]! } : null;
}
