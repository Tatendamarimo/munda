import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approximateArea, nameDeviceArea, pickDeviceArea, selectedDeviceArea } from '../src/data/deviceArea';
import { prefs, updatePrefs } from '../src/data/prefs';

describe('explicit approximate device area', () => {
  beforeEach(() => { const data = new Map<string,string>(); vi.stubGlobal('localStorage', {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); updatePrefs({place:'Original town'}); });
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
  it('resolves a readable name and sends only rounded coordinates', async () => {
    const request = vi.fn().mockResolvedValue({ok:true,json:async()=>({city:'Harare',countryName:'Zimbabwe'})});
    vi.stubGlobal('fetch', request);
    vi.stubGlobal('navigator', {onLine:true});
    const area = approximateArea(-17.82512345,31.03398765);
    expect(await nameDeviceArea(area)).toEqual({...area,label:'Harare, Zimbabwe'});
    const url = new URL(request.mock.calls[0]![0]);
    expect(url.searchParams.get('latitude')).toBe(String(area.latitude));
    expect(url.searchParams.get('longitude')).toBe(String(area.longitude));
  });
  it('retains a usable area if the name lookup fails', async () => {
    vi.stubGlobal('navigator', {onLine:true});
    const area=approximateArea(-17.8,31);
    expect(await nameDeviceArea(area)).toEqual(area);
  });
  it('does not look up a name when offline', async () => {
    vi.stubGlobal('navigator', {onLine:false});
    const area=approximateArea(-17.8,31);
    expect(await nameDeviceArea(area)).toEqual(area);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('stores the name while retaining the coarse cell for weather', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({locality:'Wedza',countryName:'Zimbabwe'})}));
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(ok:Function)=>ok({coords:{latitude:-18.6,longitude:31.5}})}});
    await pickDeviceArea();
    expect(prefs.value.place).toBe('Wedza, Zimbabwe');
    expect(selectedDeviceArea()).toEqual({...approximateArea(-18.6,31.5),label:'Wedza, Zimbabwe'});
  });
  it('does not overwrite manual edits during lookup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async()=>{updatePrefs({place:'My town'});return {ok:true,json:async()=>({city:'Harare'})};}));
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(ok:Function)=>ok({coords:{latitude:-17.8,longitude:31}})}});
    await pickDeviceArea();
    expect(prefs.value.place).toBe('My town');
    expect(selectedDeviceArea()).toBeNull();
  });

});
