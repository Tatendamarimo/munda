import { describe, expect, it } from 'vitest';
import { areaSummary, coarseCell, isGroupId, newGroupId, normalizeCode } from '../src/domain/groups';
import type { Observation } from '../src/domain/models';
import { emptyCore } from '../src/domain/models';

describe('group codes', () => {
  it('makes codes the rules accept', () => {
    for (let i = 0; i < 50; i++) expect(newGroupId()).toMatch(/^g-[A-Z2-9]{6}$/);
  });
  it('reads a code however it is typed', () => {
    expect(normalizeCode(' 7kq2mx ')).toBe('g-7KQ2MX');
    expect(normalizeCode('G-7KQ2MX')).toBe('g-7KQ2MX');
    expect(normalizeCode('7KQ 2MX')).toBe('g-7KQ2MX');
    expect(isGroupId(normalizeCode('abc'))).toBe(false);
  });
});

describe('coarse location', () => {
  it('rounds to a square about 5 km wide, never finer', () => {
    expect(coarseCell(-18.6123, 31.5711)).toBe('-18.60,31.55');
    expect(coarseCell(-18.6377, 31.5949)).toBe('-18.65,31.60');
  });
});

const obs = (p: Partial<Observation>): Observation => ({
  id: Math.random().toString(36), orgId: 'g-7KQ2MX', ownerUid: 'u1', crop: 'MAIZE', plot: 'P', plotKey: 'P', cropStage: 'UNKNOWN',
  description: 'd', core: emptyCore(), followUps: [], hadPhoto: false, record: null, origin: 'CLOUD', createdAtMillis: 1000,
  reviewStatus: 'NOT_STARTED', review: null, recordError: null, ...p,
});
const cause = (guideId: string) => ({ summary: 's', symptoms: [], urgency: 'SOON' as const, uncertaintyNote: 'u',
  possibleCauses: [{ guideId, name: guideId, likelihood: 'MEDIUM' as const, supporting: [], againstOrMissing: [], checkNext: 'c' }] });

describe('area summary for the officer', () => {
  const now = 10 * 86_400_000;
  it('counts farms (not checks) per problem and area, this week only', () => {
    const s = areaSummary([
      obs({ ownerUid: 'a', area: 'Wedza', record: cause('fall_armyworm'), createdAtMillis: now - 1000 }),
      obs({ ownerUid: 'a', area: 'Wedza', record: cause('fall_armyworm'), createdAtMillis: now - 2000 }),
      obs({ ownerUid: 'b', area: 'Wedza', record: cause('fall_armyworm'), createdAtMillis: now - 3000 }),
      obs({ ownerUid: 'c', area: 'Hwedza East', record: cause('nitrogen'), createdAtMillis: now - 4000 }),
      obs({ ownerUid: 'd', area: 'Wedza', record: cause('fall_armyworm'), createdAtMillis: now - 9 * 86_400_000 }),
      obs({ ownerUid: 'e', area: 'Wedza', record: null, createdAtMillis: now - 1000 }),
    ], now);
    expect(s[0]).toMatchObject({ problem: 'fall_armyworm', area: 'Wedza', farms: 2, checks: 3 });
    expect(s[1]).toMatchObject({ problem: 'nitrogen', area: 'Hwedza East', farms: 1 });
    expect(s).toHaveLength(2);
  });
  it('flags problems getting worse', () => {
    const s = areaSummary([
      obs({ ownerUid: 'a', area: 'Wedza', record: cause('fall_armyworm'), createdAtMillis: now - 1000,
        review: { summary: 'r', patterns: [{ kind: 'WORSENING', summary: 'w', relatedIds: [], source: 'RULE' }], updatedCauses: [], nextChecks: [], reviewedAtMillis: 0, historyConsidered: 1 } }),
    ], now);
    expect(s[0]!.worsening).toBe(1);
  });
});
