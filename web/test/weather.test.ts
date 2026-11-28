import { prefs } from '../src/data/prefs';
import { connectivity } from '../src/data/connectivity';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cropWeeks } from '../src/data/prefs';
import { freshWeather, parseGeocode, parseOpenMeteo, weatherCondition, visibleForecastDays, refreshWeather, weather, weatherEnabled, setWeatherEnabled } from '../src/data/weather';

const now = Date.UTC(2026, 10, 24, 9); // Tuesday 24 Nov 2026
const sample = {
  current: { temperature_2m: 24.4 },
  daily: { time: ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'], precipitation_sum: [0, 1.2, 8.5, 0] },
};

describe('Open-Meteo parsing', () => {
  it('reads temperature and the first rainy day in the next 3 days', () => {
    expect(parseOpenMeteo(sample, now)).toEqual({ tempC: 24, rainSoon: true, rainDay: 4, rainAt: Date.UTC(2026, 10, 26, 12), at: now });
  });
  it('dry days ahead', () => {
    const dry = { ...sample, daily: { ...sample.daily, precipitation_sum: [0, 0, 4.9, 30] } };
    expect(parseOpenMeteo(dry, now)).toMatchObject({ rainSoon: false, rainDay: null });
  });
  it('rejects incomplete or missing data', () => {
    expect(parseOpenMeteo({ daily: sample.daily }, now)).toBeNull();
    expect(parseOpenMeteo({ current: sample.current }, now)).toBeNull();
    expect(parseOpenMeteo(null, now)).toBeNull();
    expect(parseOpenMeteo('nope', now)).toBeNull();
  });
});

describe('crop age', () => {
  it('weeks since planting, or null when unknown', () => {
    expect(cropWeeks(undefined, now)).toBeNull();
    expect(cropWeeks(now - 43 * 86_400_000, now)).toBe(6);
    expect(cropWeeks(now + 86_400_000, now)).toBeNull();
  });
});

describe('stale forecasts', () => {
  const w = parseOpenMeteo(sample, now)!;
  const H = 3_600_000;
  it('shows a fresh forecast as is', () => {
    expect(freshWeather(w, now + 2 * H)).toEqual(w);
  });
  it('hides a forecast older than a day', () => {
    expect(freshWeather(w, now + 25 * H)).toBeNull();
    expect(freshWeather(null, now)).toBeNull();
  });
  it('drops rain whose day has already passed', () => {
    const rainedYesterday = { ...w, rainAt: now - 20 * H, rainDay: 1 };
    expect(freshWeather(rainedYesterday, now + 2 * H)).toMatchObject({ rainSoon: false, rainDay: null, rainAt: null, tempC: 24 });
  });
});

describe('finding a typed place when location is blocked', () => {
  it('takes the first match', () => {
    expect(parseGeocode({ results: [{ name: 'Marondera', country: 'Zimbabwe', latitude: -18.19, longitude: 31.55 }, { latitude: 1, longitude: 2 }] })).toEqual({ latitude: -18.19, longitude: 31.55, label: 'Marondera, Zimbabwe' });
    expect(parseGeocode({ results: [{ name: 'X', latitude: 1, longitude: 2 }] })?.label).toBe('X');
  });
  it('prefers a town or village over a mountain, and names the province', () => {
    const json = { results: [
      { name: 'Wedza', admin1: 'Midlands Province', country: 'Zimbabwe', latitude: -20.25, longitude: 29.86, feature_code: 'MT' },
      { name: 'Wedza', admin1: 'Mashonaland East Province', country: 'Zimbabwe', latitude: -18.62, longitude: 31.57, feature_code: 'PPL' },
    ] };
    expect(parseGeocode(json)).toEqual({ latitude: -18.62, longitude: 31.57, label: 'Wedza, Mashonaland East, Zimbabwe' });
  });

  it('returns null when nothing matched', () => {
    expect(parseGeocode({})).toBeNull();
    expect(parseGeocode({ results: [] })).toBeNull();
    expect(parseGeocode({ results: [{ name: 'x' }] })).toBeNull();
    expect(parseGeocode(null)).toBeNull();
  });
});


describe('detailed forecasts', () => {
  const detailed = { ...sample, timezone: 'Africa/Harare', current: { ...sample.current, weather_code: 3, relative_humidity_2m: 65, wind_speed_10m: 12.4 }, daily: { ...sample.daily, temperature_2m_max: [28,29,25,27], temperature_2m_min: [16,17,15,18], precipitation_probability_max: [10,20,90,null], weather_code: [3,1,63,0] } };
  it('retains rain chance separately from rain amount and preserves missing values', () => {
    const forecast = parseOpenMeteo(detailed, now)!;
    expect(forecast).toMatchObject({ humidity: 65, windKph: 12.4, code: 3, timezone: 'Africa/Harare' });
    expect(forecast.days![2]).toMatchObject({ rainChance: 90, rainMm: 8.5, minC: 15, maxC: 25 });
    expect(forecast.days![3]!.rainChance).toBeNull();
    expect(parseOpenMeteo({ ...detailed, daily: { ...detailed.daily, precipitation_sum: [null,0,0,0] } }, now)!.days![0]!.rainMm).toBeNull();
  });
  it('uses current weather code rather than rain forecast later in the week', () => {
    expect(weatherCondition(3)).toBe('cloudy'); expect(weatherCondition(0)).toBe('sunny');
    expect(weatherCondition(63)).toBe('wet'); expect(weatherCondition(95)).toBe('storm');
    expect(weatherCondition(null)).toBe('unknown');
  });
  it('filters expired days in the farm timezone rather than the browser timezone', () => {
    const forecast = parseOpenMeteo(detailed, now)!;
    forecast.timezone = 'America/Los_Angeles';
    expect(visibleForecastDays(forecast, Date.UTC(2026,10,27,1)).map(d => d.date)).toEqual(['2026-11-26','2026-11-27']);
  });
  it('does not display malformed or future-dated cache records', () => {
    const w = parseOpenMeteo(detailed, now)!;
    expect(freshWeather({ ...w, at: NaN }, now)).toBeNull();
    expect(freshWeather({ ...w, at: now + 3600000 }, now)).toBeNull();
  });
});

describe('weather location and consent', () => {
  afterEach(() => { vi.unstubAllGlobals(); weatherEnabled.set(false); weather.set(null); connectivity.set(true); });
  it('clears a different area even when offline and the cache is otherwise fresh', async () => {
    prefs.set({ ...prefs.value, place: 'Marondera' });
    weather.set({ ...parseOpenMeteo(sample, Date.now())!, areaKey: 'Harare' });
    weatherEnabled.set(true); connectivity.set(false);
    await refreshWeather(); expect(weather.value).toBeNull();
  });
  it('does not restore weather after opting out while a request is in flight', async () => {
    prefs.set({ ...prefs.value, place: 'Harare' }); weatherEnabled.set(true);
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; })); vi.stubGlobal('fetch', fetcher);
    const running = refreshWeather(true);
    setWeatherEnabled(false);
    resolve({ ok: true, json: async () => ({ results: [{ latitude: -17.8, longitude: 31, name: 'Harare' }] }) } as Response);
    await running; expect(weather.value).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not fetch anything when weather is disabled', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); weatherEnabled.set(false);
    await refreshWeather(true); expect(fetcher).not.toHaveBeenCalled();
  });
});
