import { describe, expect, it } from 'vitest';
import { exportI18n, flatten } from '../src/i18n/export';

describe('text shared with Android', () => {
  it('flattens nested sections', () => {
    expect(flatten({ a: { b: 'x', c: { d: 'y' } } })).toEqual({ 'a.b': 'x', 'a.c.d': 'y' });
  });

  it('shared/i18n is up to date (run npm run export:i18n)', () => {
    const committed = import.meta.glob('../../shared/i18n/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [file, json] of Object.entries(exportI18n())) {
      expect(committed[`../../shared/i18n/${file}`], file).toBe(json);
    }
  });

  it('every language has every English key', () => {
    const files = exportI18n();
    const en = Object.keys(JSON.parse(files['en.json']!).strings);
    for (const lang of ['sn', 'nd', 'sw', 'fr', 'pt', 'es']) {
      const keys = new Set(Object.keys(JSON.parse(files[`${lang}.json`]!).strings));
      expect(en.filter((k) => !keys.has(k)), lang).toEqual([]);
    }
  });
});
