import { describe, expect, it } from 'vitest';
import { alertText } from '../src/ui/alertText';
import { translate } from '../src/i18n';
import '../src/i18n/sn';

describe('a confirmed alert, in the reader’s language', () => {
  it('says one farm, not 1 farms', () => {
    expect(alertText((k, v) => translate('en', k, v), 'en', { problem: 'fall_armyworm', area: 'Wedza', count: 1 }))
      .toBe('Fall armyworm confirmed on a farm in Wedza. Check your maize.');
  });
  it('counts several farms', () => {
    expect(alertText((k, v) => translate('en', k, v), 'en', { problem: 'fall_armyworm', area: 'Wedza', count: 3 })).toContain('on 3 farms in Wedza');
  });
  it('writes in the farmer’s language, whatever the officer used', () => {
    const sn = alertText((k, v) => translate('sn', k, v), 'sn', { problem: 'fall_armyworm', area: 'Wedza', count: 2 });
    expect(sn).toContain('Tarisa chibage chako');
  });
});
