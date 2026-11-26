import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approximateArea, pickDeviceArea, selectedDeviceArea } from '../src/data/deviceArea';
import { prefs, updatePrefs } from '../src/data/prefs';

describe('explicit approximate device area', () => {
  beforeEach(() => { const data = new Map<string,string>(); vi.stubGlobal('localStorage', {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}); updatePrefs({place:'Original town'}); });
  afterEach(() => vi.unstubAllGlobals());
  it('does not retain exact GPS precision and ignores a selection after manual editing', async () => {
    const request = vi.fn((ok) => ok({coords:{latitude:-17.82512345,longitude:31.03398765}}));
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:request}});
    expect(request).not.toHaveBeenCalled();
    await pickDeviceArea();
    expect(request).toHaveBeenCalledTimes(1);
    expect(selectedDeviceArea()).toEqual(approximateArea(-17.82512345,31.03398765));
    expect(localStorage.getItem('munda.deviceArea')).not.toContain('82512345');
    updatePrefs({place:'Another town'});
    expect(selectedDeviceArea()).toBeNull();
  });
  it('preserves the typed area if permission is denied', async () => {
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(_ok:unknown,fail:(e:unknown)=>void)=>fail({code:1})}});
    await expect(pickDeviceArea()).rejects.toEqual({code:1});
    expect(prefs.value.place).toBe('Original town');
    expect(selectedDeviceArea()).toBeNull();
  });
  it('rejects invalid coordinates',()=>{ expect(()=>approximateArea(NaN,31)).toThrow(); expect(()=>approximateArea(91,31)).toThrow(); });
});
