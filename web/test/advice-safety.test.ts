import { describe, expect, it } from 'vitest';
import { guideFor } from '../src/domain/guide';
import { OUTSIDE_GUIDE_CHECK, parseRecord, parseReview } from '../src/domain/parser';
import { guideReading } from '../src/domain/reading';
import { localizedEntry } from '../src/domain/localize';
import { translate } from '../src/i18n';
const guide = guideFor('MAIZE');
describe('advice safety boundaries',()=>{
  it('filters dose-bearing cloud review actions',()=>{
    const r=parseReview(JSON.stringify({summary:'Compare observations.',patterns:[],updatedCauses:[],nextChecks:['Apply 50 kg per hectare','Compare lower and upper leaves']}),new Set(),guide);
    expect(r.ok && r.value.nextChecks).toEqual(['Compare lower and upper leaves']);
  });
  it('does not retain a history pattern with only invented references',()=>{
    const r=parseReview(JSON.stringify({summary:'No supported pattern.',patterns:[{kind:'SPREADING',summary:'Spreading everywhere',relatedIds:['invented']}],nextChecks:[]}),new Set(['real']),guide);
    expect(r.ok && r.value.patterns).toEqual([]);
  });
  it('keeps unsupported causes on an extension-referral path',()=>{
    const r=parseRecord(JSON.stringify({summary:'Unknown damage.',possibleCauses:[{guideId:'other',name:'Unreviewed condition',likelihood:'HIGH',supporting:['A','B'],checkNext:'Buy and apply a treatment'}]}),guide,new Set());
    expect(r.ok && r.value.possibleCauses[0]?.checkNext).toBe(OUTSIDE_GUIDE_CHECK);
    expect(r.ok && r.value.possibleCauses[0]?.likelihood).toBe('MEDIUM');
  });
  it('does not let the model rename a reviewed guide cause as a different disease',()=>{
    const r=parseRecord(JSON.stringify({summary:'Yellow leaves.',possibleCauses:[{guideId:'nitrogen',name:'Confirmed lethal virus',likelihood:'MEDIUM',supporting:['A'],checkNext:'Compare leaves'}]}),guide,new Set(['nitrogen']));
    expect(r.ok && r.value.possibleCauses[0]?.name).toBe(guide.get('nitrogen')!.name);
  });
  it('includes look-alike distinctions in the complete reading',()=>{
    for(const entry of guide.entries) expect(guideReading(entry,localizedEntry(entry,'en'),k=>translate('en',k))).toContain(entry.distinguish);
  });
});
