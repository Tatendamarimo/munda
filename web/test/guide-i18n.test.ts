import { describe, expect, it } from 'vitest';
import { guideFor, normalizeText } from '../src/domain/guide';
import { causeDisplay, localizedEntry } from '../src/domain/localize';
import type { AffectedArea, CoreAnswers, CropStage, Rainfall } from '../src/domain/models';
import { emptyCore } from '../src/domain/models';

const maize = guideFor('MAIZE');
const core = (area: AffectedArea = 'UNKNOWN', rainfall: Rainfall = 'UNKNOWN'): CoreAnswers => ({ ...emptyCore(), area, rainfall });

describe('multilingual retrieval', () => {
  const shona: Array<{ name: string; text: string; core?: CoreAnswers; stage?: CropStage; must: string[] }> = [
    { name: 'sn: yellow lower leaves after heavy rain', text: 'Mashizha ari pasi ari kuita yellow uye miti midiki', core: core('PATCHES', 'HEAVY'), must: ['nitrogen', 'waterlogging'] },
    { name: 'sn: holes and sawdust in the funnel', text: 'Mashizha ane maburi uye pane zvinenge hupfu mukati memoyo wechibage', must: ['fall_armyworm'] },
    { name: 'sn: leaves rolling in the afternoon', text: 'Mashizha ari kupeta uye kuita grey masikati', core: core('MOST_OF_FIELD', 'NONE'), must: ['drought'] },
    { name: 'sn: purple young plants', text: 'Miti midiki yava pepuru kumicheto yemashizha uye iri kunonoka kukura', stage: 'EMERGENCE', must: ['phosphorus'] },
    { name: 'sn: wilting with pink-flowered weeds', text: 'Chibage chiri kusvava kunyange ivhu rakanyorova, pane sora diki rine maruva epinki pasi', must: ['striga'] },
  ];
  for (const s of shona) {
    it(s.name, () => {
      const got = maize.relevant(s.text, s.core ?? emptyCore(), s.stage ?? 'EARLY_GROWTH', 5).map((e) => e.id);
      for (const id of s.must) expect(got).toContain(id);
    });
  }

  it('normalises accents and case', () => {
    expect(normalizeText('Hojas AMARILLAS y maïs')).toBe('hojas amarillas y mais');
  });
});

describe('localized guide entries', () => {
  const nitrogen = maize.get('nitrogen')!;
  it('uses the translation when present', () => {
    const sn = localizedEntry(nitrogen, 'sn');
    expect(sn.name).not.toBe(nitrogen.name);
    expect(sn.checkInField).not.toBe(nitrogen.checkInField);
  });
  it('falls back to English per field when a language has no file', () => {
    expect(localizedEntry(nitrogen, 'fr')).toEqual({ name: nitrogen.name, signs: nitrogen.signs, checkInField: nitrogen.checkInField });
  });
  it('every Shona entry exists in the guide', () => {
    for (const e of maize.entries) expect(localizedEntry(e, 'sn').name.trim()).not.toBe('');
  });
});

describe('cause display', () => {
  const nitrogen = { guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'HIGH' as const, supporting: [], againstOrMissing: [], checkNext: 'Compare with a top-dressed row.' };
  it('shows the translated guide name and field check, keeping the model note', () => {
    const d = causeDisplay(nitrogen, 'sn', maize);
    expect(d.name).toBe(localizedEntry(maize.get('nitrogen')!, 'sn').name);
    expect(d.check).toBe(localizedEntry(maize.get('nitrogen')!, 'sn').checkInField);
    expect(d.modelCheck).toBe('Compare with a top-dressed row.');
  });
  it('in English uses the model’s own specific check', () => {
    expect(causeDisplay(nitrogen, 'en', maize)).toEqual({ name: 'Nitrogen deficiency', check: 'Compare with a top-dressed row.', modelCheck: null });
  });
  it('keeps causes outside the guide as the model wrote them', () => {
    const other = { ...nitrogen, guideId: null, name: 'Hail damage', checkNext: 'Look for torn leaves after the storm.' };
    expect(causeDisplay(other, 'sn', maize)).toEqual({ name: 'Hail damage', check: 'Look for torn leaves after the storm.', modelCheck: null });
  });
});
