import { describe, expect, it } from 'vitest';
import { aiTrail } from '../src/domain/trail';
import type { Observation } from '../src/domain/models';
import { emptyCore } from '../src/domain/models';

const base: Observation = {
  id: 'a', orgId: 'o', ownerUid: 'u', crop: 'MAIZE', plot: 'P', plotKey: 'P', cropStage: 'UNKNOWN', description: 'd',
  core: emptyCore(), followUps: [], hadPhoto: false, record: null, origin: 'PENDING', createdAtMillis: 1,
  reviewStatus: 'NOT_STARTED', review: null, recordError: null,
};
const record = { summary: 's', symptoms: [], possibleCauses: [], urgency: 'ROUTINE' as const, uncertaintyNote: 'u' };
const review = { summary: 'r', patterns: [], updatedCauses: [], nextChecks: [], reviewedAtMillis: 2, historyConsidered: 0 };
const states = (o: Observation, synced: boolean) => aiTrail(o, synced).map((s) => `${s.id}:${s.state}:${s.where ?? '-'}`);

describe('where the AI worked on a record', () => {
  it('offline with no local model: only saved', () => {
    expect(states(base, false)).toEqual(['saved:done:device', 'causes:waiting:cloud', 'synced:waiting:cloud', 'review:waiting:cloud']);
  });

  it('causes on device, not yet synced', () => {
    expect(states({ ...base, record, origin: 'ON_DEVICE' }, false)).toEqual(['saved:done:device', 'causes:done:device', 'synced:waiting:cloud', 'review:waiting:cloud']);
  });

  it('the full hybrid path', () => {
    expect(states({ ...base, record, origin: 'ON_DEVICE', reviewStatus: 'DONE', review }, true)).toEqual(['saved:done:device', 'causes:done:device', 'synced:done:cloud', 'review:done:cloud']);
  });

  it('causes built in the cloud', () => {
    expect(states({ ...base, record, origin: 'CLOUD' }, true)[1]).toBe('causes:done:cloud');
  });

  it('shows failures', () => {
    expect(states({ ...base, recordError: 'x' }, true)[1]).toBe('causes:failed:cloud');
    expect(states({ ...base, record, origin: 'ON_DEVICE', reviewStatus: 'FAILED' }, true)[3]).toBe('review:failed:cloud');
  });
});
