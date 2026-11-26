import { describe, expect, it } from 'vitest';
import { guideReading, speechChunks } from '../src/domain/reading';
import { guideFor } from '../src/domain/guide';
import { localizedEntry } from '../src/domain/localize';
import { translate } from '../src/i18n';

describe('complete guide reading', () => {
  it('includes every visible content section and source note for every guide entry', () => {
    for (const entry of guideFor('MAIZE').entries) {
      const text = guideReading(entry, localizedEntry(entry, 'en'), key => translate('en', key));
      for (const value of [entry.name, entry.signs, entry.checkInField, entry.byStage, entry.likelyWhen, entry.actNow, entry.prevent, ...entry.sources?.map(s => s.title) ?? []]) if (value) expect(text).toContain(value);
      if (entry.report) expect(text).toContain(translate('en', 'guide.report'));
      if (entry.sources?.length) expect(text).toContain(translate('en', 'guide.unchecked'));
    }
  });
  it('does not drop visible English sections when the selected language is Shona', () => {
    const entry = guideFor('MAIZE').entries[0]!;
    const text = guideReading(entry, localizedEntry(entry, 'sn'), key => translate('sn', key));
    expect(text).toContain(localizedEntry(entry, 'sn').signs);
    expect(text).toContain(entry.prevent!);
  });
  it('reads long passages to the final word without omitting or duplicating content', () => {
    const text = ('Inspect the lower leaves. Compare the upper leaves. ').repeat(50) + 'Final safety note.';
    for (const limit of [160, 600]) {
      const chunks = speechChunks(text, limit);
      expect(chunks.every(c => c.length <= limit)).toBe(true);
      expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
      expect(chunks.at(-1)).toContain('Final safety note.');
    }
    expect(speechChunks('')).toEqual([]);
    expect(speechChunks('x'.repeat(1250)).join('')).toBe('x'.repeat(1250));
  });
});
