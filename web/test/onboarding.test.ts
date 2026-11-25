import { describe, expect, it } from 'vitest';
import { parseSetup, setupComplete } from '../src/data/onboarding';
describe('resumable setup',()=>{
 it('recovers from corrupted progress',()=>{expect(parseSetup('invalid')).toEqual({step:'language',completedUids:[]});expect(parseSetup('null').step).toBe('language');expect(parseSetup('{"step":"finished"}').step).toBe('language');});
 it('scopes completed setup to the signed-in identity',()=>{const s=parseSetup('{"step":"area","completedUids":["u1",3,null]}');expect(s.step).toBe('area');expect(setupComplete(s,'u1')).toBe(true);expect(setupComplete(s,'u2')).toBe(false);});
});
