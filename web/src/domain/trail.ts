import type { Observation } from './models';

export type TrailId = 'saved' | 'causes' | 'synced' | 'review';
export interface TrailStep {
  id: TrailId;
  state: 'done' | 'waiting' | 'failed';
  /** Where this step runs (or will run). */
  where: 'device' | 'cloud';
}

/**
 * The hybrid story of one record: saved on the device, causes on the device or in the cloud,
 * synced, then the cloud history review. Derived from stored state, so it updates live as the
 * sync processor works.
 */
export function aiTrail(o: Observation, synced: boolean): TrailStep[] {
  const causes: TrailStep = o.record
    ? { id: 'causes', state: 'done', where: o.origin === 'ON_DEVICE' ? 'device' : 'cloud' }
    : { id: 'causes', state: o.recordError ? 'failed' : 'waiting', where: 'cloud' };
  const review: TrailStep['state'] = o.reviewStatus === 'DONE' ? 'done' : o.reviewStatus === 'FAILED' ? 'failed' : 'waiting';
  return [
    { id: 'saved', state: 'done', where: 'device' },
    causes,
    { id: 'synced', state: synced ? 'done' : 'waiting', where: 'cloud' },
    { id: 'review', state: review, where: 'cloud' },
  ];
}
