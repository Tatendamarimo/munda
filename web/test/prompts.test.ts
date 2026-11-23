import { describe, expect, it } from 'vitest';
import { questionsPrompt, recordPrompt, reviewPrompt, type ObservationInput } from '../src/ai/prompts';
import { guideFor } from '../src/domain/guide';
import type { Observation } from '../src/domain/models';
import { emptyCore } from '../src/domain/models';

const input: ObservationInput = { crop: 'MAIZE', plot: 'Low field', stage: 'EARLY_GROWTH', description: 'Lower leaves yellow', core: emptyCore(), followUps: [], photoBase64: null };
const cands = guideFor('MAIZE').entries.slice(0, 3);
const target: Observation = {
  id: 'a', orgId: 'demo', ownerUid: 'u', crop: 'MAIZE', plot: 'Low field', plotKey: 'LOW-FIELD', cropStage: 'EARLY_GROWTH', description: 'd',
  core: emptyCore(), followUps: [], hadPhoto: false, record: null, origin: 'CLOUD', createdAtMillis: 0, reviewStatus: 'NOT_STARTED', review: null, recordError: null,
};

describe('output language in cloud prompts', () => {
  it('asks for the farmer’s language when it is not English', () => {
    expect(recordPrompt(input, cands, 'sn')).toContain('Write all text values in Shona');
    expect(questionsPrompt(input, cands, 'fr')).toContain('Write all text values in French');
    expect(reviewPrompt(target, [], [], [], 'sw')).toContain('Write all text values in Swahili');
  });
  it('keeps keys and enums in English', () => {
    expect(recordPrompt(input, cands, 'sn')).toContain('Keep JSON keys, ids and enum values in English');
  });
  it('adds nothing for English or when no language is given', () => {
    expect(recordPrompt(input, cands)).not.toContain('Write all text values');
    expect(recordPrompt(input, cands, 'en')).not.toContain('Write all text values');
    expect(reviewPrompt(target, [], [], [])).not.toContain('Write all text values');
  });
});
