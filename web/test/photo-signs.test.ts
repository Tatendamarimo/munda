import { describe, expect, it } from 'vitest';
import { photoPrompt } from '../src/ai/prompts';
import { parsePhotoSigns } from '../src/domain/parser';

describe('describing a photo before matching the guide', () => {
  it('asks for visible signs only, never a cause', () => {
    const p = photoPrompt('MAIZE');
    expect(p).toContain('only what you can see');
    expect(p).toContain('Do not name a disease, pest or deficiency');
    expect(photoPrompt('MAIZE', 'sn')).toContain('Write all text values in Shona');
  });

  it('reads the signs and whether the photo was clear', () => {
    expect(parsePhotoSigns('{"signs":"  Lower leaves yellow from the tip in a V.  ","clear":true}')).toEqual({ ok: true, value: { signs: 'Lower leaves yellow from the tip in a V.', clear: true } });
  });

  it('treats an empty description as unclear', () => {
    expect(parsePhotoSigns('{"signs":"","clear":true}')).toEqual({ ok: true, value: { signs: '', clear: false } });
  });

  it('caps the length', () => {
    const r = parsePhotoSigns(JSON.stringify({ signs: 'x'.repeat(900), clear: true }));
    expect(r.ok && r.value.signs.length).toBe(300);
  });

  it('fails on junk', () => {
    expect(parsePhotoSigns('no json').ok).toBe(false);
  });
});
