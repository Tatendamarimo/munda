import { describe, expect, it } from 'vitest';
import { guideFor } from '../src/domain/guide';
import { parseRecord } from '../src/domain/parser';

const guide = guideFor('MAIZE');
const record = (causes: unknown[]) => JSON.stringify({ summary: 's', symptoms: [], possibleCauses: causes, urgency: 'SOON', uncertaintyNote: 'u' });
const parse = (causes: unknown[], allowed = ['nitrogen']) => {
  const r = parseRecord(record(causes), guide, new Set(allowed));
  if (!r.ok) throw new Error(r.error);
  return r.value.possibleCauses;
};

describe('causes outside the guide (Gemini filling gaps)', () => {
  it('are kept but never above "Possible"', () => {
    const [c] = parse([{ guideId: 'other', name: 'Hail damage', likelihood: 'HIGH', supporting: ['a', 'b', 'c'], againstOrMissing: [], checkNext: 'Look for torn leaves on one side' }]);
    expect(c).toMatchObject({ guideId: null, name: 'Hail damage', likelihood: 'MEDIUM' });
  });

  it('only one per answer', () => {
    const out = parse([
      { guideId: 'other', name: 'Hail damage', likelihood: 'MEDIUM', supporting: ['a'], againstOrMissing: [], checkNext: 'x' },
      { guideId: 'other', name: 'Herbicide drift', likelihood: 'MEDIUM', supporting: ['a'], againstOrMissing: [], checkNext: 'y' },
    ]);
    expect(out.filter((c) => c.guideId === null).map((c) => c.name)).toEqual(['Hail damage']);
  });

  it('a real guide problem the shortlist missed still counts as the guide entry', () => {
    const [c] = parse([{ guideId: 'common_rust', name: 'Rust', likelihood: 'MEDIUM', supporting: ['a'], againstOrMissing: [], checkNext: 'rub a pustule' }]);
    expect(c!.guideId).toBe('common_rust');
  });
});

describe('no doses in advice', () => {
  it('replaces a check that gives a dose', () => {
    const [c] = parse([{ guideId: 'nitrogen', name: 'N', likelihood: 'MEDIUM', supporting: ['a'], againstOrMissing: [], checkNext: 'Apply 50 kg per hectare of urea' }]);
    expect(c!.checkNext).toBe(guide.get('nitrogen')!.checkInField);
  });

  it('drops evidence lines with doses and keeps the rest', () => {
    const [c] = parse([{ guideId: 'nitrogen', name: 'N', likelihood: 'MEDIUM', supporting: ['lower leaves yellow', 'needs 20 ml per litre'], againstOrMissing: [], checkNext: 'Compare leaves' }]);
    expect(c!.supporting).toEqual(['lower leaves yellow']);
  });

  it('outside the guide, a dose-only check becomes "ask your extension officer"', () => {
    const [c] = parse([{ guideId: 'other', name: 'Mites', likelihood: 'LOW', supporting: ['a'], againstOrMissing: [], checkNext: 'Spray 2 ml per litre' }]);
    expect(c!.checkNext).toMatch(/extension officer/i);
  });
});
