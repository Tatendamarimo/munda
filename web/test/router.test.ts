import { describe, expect, it } from 'vitest';
import { href, parseRoute } from '../src/ui/routes';

describe('routes', () => {
  it('parses each screen', () => {
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/plots')).toEqual({ name: 'plots' });
    expect(parseRoute('#/plots/RIVER-PLOT')).toEqual({ name: 'plot', key: 'RIVER-PLOT' });
    expect(parseRoute('#/guide')).toEqual({ name: 'guide' });
    expect(parseRoute('#/guide/fall_armyworm')).toEqual({ name: 'guideEntry', id: 'fall_armyworm' });
    expect(parseRoute('#/me')).toEqual({ name: 'me' });
    expect(parseRoute('#/observe')).toEqual({ name: 'observe' });
    expect(parseRoute('#/o/abc123')).toEqual({ name: 'record', id: 'abc123' });
  });

  it('decodes plot keys with special characters', () => {
    expect(parseRoute(href({ name: 'plot', key: 'MUNDA-WEPASI/2' }))).toEqual({ name: 'plot', key: 'MUNDA-WEPASI/2' });
  });

  it('falls back to home for unknown paths', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/o/')).toEqual({ name: 'home' });
  });

  it('round-trips', () => {
    for (const h of ['#/', '#/plots', '#/plots/RIVER-PLOT', '#/guide', '#/guide/striga', '#/me', '#/observe', '#/o/abc']) {
      expect(href(parseRoute(h))).toBe(h);
    }
  });
});
