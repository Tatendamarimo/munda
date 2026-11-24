import { describe, expect, it } from 'vitest';
import en from '../../shared/i18n/en.json';
import sn from '../../shared/i18n/sn.json';
import nd from '../../shared/i18n/nd.json';
import sw from '../../shared/i18n/sw.json';
import fr from '../../shared/i18n/fr.json';
import pt from '../../shared/i18n/pt.json';
import es from '../../shared/i18n/es.json';

type D = { strings: Record<string, string> };
const others: Record<string, D> = { sn, nd, sw, fr, pt, es };

describe('no sentence is left in English', () => {
  // A sentence that falls back to English (from `...en.section`) means a farmer reads English mid-screen.
  for (const [lang, d] of Object.entries(others)) {
    it(lang, () => {
      const same = Object.entries((en as D).strings)
        .filter(([k, v]) => v.length > 12 && v.includes(' ') && !k.startsWith('lang') && d.strings[k] === v)
        .map(([k]) => k);
      expect(same).toEqual([]);
    });
  }
});
