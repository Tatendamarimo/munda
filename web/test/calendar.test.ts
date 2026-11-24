import { describe, expect, it } from 'vitest';
import { formatDate, relativeTime, shortDate, weekday } from '../src/i18n';

const nov24 = Date.UTC(2026, 10, 24, 12);
const hour = 3_600_000;

describe('Shona and Ndebele dates (no browser calendar for them)', () => {
  it('names the days', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => weekday(d, 'sn'))).toEqual(['Svondo', 'Muvhuro', 'Chipiri', 'Chitatu', 'China', 'Chishanu', 'Mugovera']);
    expect(weekday(3, 'nd')).toBe('uLwesithathu');
  });

  it('names the months', () => {
    expect(shortDate(nov24, 'sn')).toBe('24 Mbudzi');
    expect(formatDate(nov24, 'sn')).toBe('24 Mbudzi 2026');
    expect(shortDate(nov24, 'nd')).toBe('24 uLwezi');
  });

  it('says how long ago', () => {
    expect(relativeTime(nov24 - 5 * hour, nov24, 'sn')).toBe('maawa 5 apfuura');
    expect(relativeTime(nov24 - 30 * 60_000, nov24, 'sn')).toBe('maminitsi 30 apfuura');
    expect(relativeTime(nov24 - 24 * hour, nov24, 'sn')).toBe('nezuro');
    expect(relativeTime(nov24 - 3 * 24 * hour, nov24, 'sn')).toBe('mazuva 3 apfuura');
    expect(relativeTime(nov24 - 24 * hour, nov24, 'nd')).toBe('izolo');
    expect(relativeTime(nov24 - 10 * 24 * hour, nov24, 'sn')).toBe('14 Mbudzi');
  });

  it('leaves other languages to the browser', () => {
    expect(weekday(3, 'en')).toBe('Wednesday');
    expect(weekday(3, 'fr')).toBe('mercredi');
  });
});
