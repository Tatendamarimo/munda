import { describe, it, expect } from 'vitest';
import { guideFor } from '../src/domain/guide';
import { emptyCore } from '../src/domain/models';
import { parseRecord, MIXED_NOTE, NO_CLEAR_PROBLEM_NOTE, UNCERTAIN_NOTE } from '../src/domain/parser';
import { questionsPrompt, recordPrompt, type ObservationInput } from '../src/ai/prompts';
import { guideReading, speechChunks } from '../src/domain/reading';
import { localizedEntry } from '../src/domain/localize';
import { translate } from '../src/i18n';
const guide = guideFor('MAIZE');
const input: ObservationInput = { crop:'MAIZE', plot:'A', stage:'EARLY_GROWTH', description:'Twisted leaves after spraying', core:emptyCore(), followUps:[], photoBase64:null };
const examples = [
  ['herbicide_injury', 'Bleached white leaves and twisted leaves after spray drift'],
  ['hail_wind_damage', 'Hailstones left shredded leaves and bruised stalks after storm damage'],
  ['cold_frost_injury', 'Frost damage after a cold night with water soaked leaves'],
  ['seedling_disease', 'Poor emergence with rotting seed and collapsed seedlings'],
  ['root_rot', 'Root rot with brown roots and root lesions in an uneven stand'],
  ['stalk_rot', 'Stalk rot and soft stalk with shredded pith; plants falling over'],
];
describe('expanded maize differentials', () => {
  for (const [id, description] of examples) it(`retrieves ${id} without dropping its checks and sources`, () => {
    const entry = guide.get(id)!;
    expect(entry).toBeDefined();
    expect(guide.relevant(description!, emptyCore(), 'UNKNOWN', 5).map(e=>e.id)).toContain(id);
    expect(entry.sources?.length).toBeGreaterThan(0);
    for (const value of [entry.signs,entry.distinguish,entry.checkInField,entry.byStage,entry.likelyWhen,entry.actNow,entry.prevent]) expect(value?.trim()).toBeTruthy();
  });
  it('allows recent management history only when it distinguishes the candidate causes', () => {
    const prompt=questionsPrompt(input,guide.entries.slice(0,4));
    expect(prompt).toContain('recent management history');
    expect(prompt).toContain('fertilizer or manure only if');
    expect(prompt).toContain('Already recorded:');
    expect(recordPrompt(input,guide.entries)).toContain('do not force a disease or certify health');
  });
});
describe('abstention and mixed observations', () => {
  for (const [assessment,note] of [['NO_CLEAR_PROBLEM',NO_CLEAR_PROBLEM_NOTE],['UNCERTAIN',UNCERTAIN_NOTE]]) it(`accepts ${assessment} without inventing a cause`, () => {
    const r=parseRecord(JSON.stringify({assessment,summary:'Observation recorded.',possibleCauses:[],uncertaintyNote:'Definitely healthy'}),guide,new Set());
    expect(r.ok && r.value.possibleCauses).toEqual([]);
    expect(r.ok && r.value.uncertaintyNote).toBe(note);
  });
  it('does not retain a contradictory disease when the assessment abstains',()=>{
    const r=parseRecord(JSON.stringify({assessment:'UNCERTAIN',summary:'Insufficient evidence.',possibleCauses:[{guideId:'nitrogen',likelihood:'HIGH',supporting:['a','b']}]}),guide,new Set());
    expect(r.ok && r.value.possibleCauses).toEqual([]);
  });
  it('keeps mixed problems tentative even with two supporting strings',()=>{
    const r=parseRecord(JSON.stringify({assessment:'MIXED',summary:'Separate symptoms.',possibleCauses:[{guideId:'nitrogen',likelihood:'HIGH',supporting:['a','b']}]}),guide,new Set());
    expect(r.ok && r.value.possibleCauses[0]?.likelihood).toBe('MEDIUM');
    expect(r.ok && r.value.uncertaintyNote).toBe(MIXED_NOTE);
  });
  it('still rejects malformed or empty ordinary responses',()=>{
    expect(parseRecord(JSON.stringify({assessment:'UNCERTAIN',summary:'Missing causes array'}),guide,new Set()).ok).toBe(false);
    expect(parseRecord(JSON.stringify({assessment:'POSSIBLE_CAUSES',summary:'No causes',possibleCauses:[]}),guide,new Set()).ok).toBe(false);
  });
});
it('reads every acid-soil section through the last safety note in short passages',()=>{
  const e=guide.get('acid_soil')!;
  const text=guideReading(e,localizedEntry(e,'en'),key=>translate('en',key));
  const chunks=speechChunks(text,140);
  expect(chunks.every(c=>c.length<=140)).toBe(true);
  expect(chunks.join(' ').replace(/\s+/g,' ')).toBe(text.replace(/\s+/g,' '));
  for(const field of [e.signs,e.checkInField,e.distinguish,e.likelyWhen,e.actNow,e.prevent]) expect(chunks.join(' ')).toContain(field);
  expect(chunks.at(-1)).toContain('before spending money.');
});
