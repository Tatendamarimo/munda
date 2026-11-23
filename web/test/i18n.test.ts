import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { sn } from '../src/i18n/sn';
import { nd } from '../src/i18n/nd';
import { sw } from '../src/i18n/sw';
import { fr } from '../src/i18n/fr';
import { pt } from '../src/i18n/pt';
import { es } from '../src/i18n/es';
import { pickInitialLang, relativeTime, translate } from '../src/i18n';

/** Every leaf path in a nested string dictionary. */
function leaves(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : leaves(v as object, `${prefix}${k}.`)));
}
function at(o: object, path: string): unknown {
  return path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);
}

describe('i18n', () => {
  it('picks the first supported browser language', () => {
    expect(pickInitialLang(['sn-ZW', 'en'])).toBe('sn');
    expect(pickInitialLang(['pt-BR'])).toBe('pt');
    expect(pickInitialLang(['de-DE'])).toBe('en');
    expect(pickInitialLang([])).toBe('en');
  });

  it('translates and falls back to English for missing keys', () => {
    expect(translate('sn', 'tabs.home')).toBe('Kumba');
    expect(translate('fr', 'tabs.home')).not.toBe('');
  });

  it('fills placeholders', () => {
    expect(translate('en', 'home.greeting', { name: 'Gogo' })).toContain('Gogo');
    expect(translate('sn', 'home.greeting', { name: 'Gogo' })).toContain('Gogo');
  });

  it('Shona has every English key, non-empty', () => {
    const missing = leaves(en).filter((k) => { const v = at(sn, k); return typeof v !== 'string' || v.trim() === ''; });
    expect(missing).toEqual([]);
  });

  it('formats relative time in the chosen language', () => {
    const now = Date.UTC(2026, 10, 24, 12);
    expect(relativeTime(now - 90_000, now, 'en')).toMatch(/2 min/);
  });
});

describe('beta languages', () => {
  for (const [code, dict] of Object.entries({ nd, sw, fr, pt, es })) {
    it(`${code} has every English key, non-empty`, () => {
      const missing = leaves(en).filter((k) => { const v = at(dict, k); return typeof v !== 'string' || v.trim() === ''; });
      expect(missing).toEqual([]);
    });
  }
  it('uses the beta dictionaries', () => {
    expect(translate('fr', 'tabs.home')).toBe('Accueil');
    expect(translate('es', 'common.notSure')).toBe('No estoy seguro');
  });
});
