import { describe, expect, it } from 'vitest';
import { cropWeeks } from '../src/data/prefs';
import { parseOpenMeteo } from '../src/data/weather';

const now = Date.UTC(2026, 10, 24, 9); // Tuesday 24 Nov 2026
const sample = {
  current: { temperature_2m: 24.4 },
  daily: { time: ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'], precipitation_sum: [0, 1.2, 8.5, 0] },
};

describe('Open-Meteo parsing', () => {
  it('reads temperature and the first rainy day in the next 3 days', () => {
    expect(parseOpenMeteo(sample, now)).toEqual({ tempC: 24, rainSoon: true, rainDay: 4, at: now });
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
