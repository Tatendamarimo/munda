import { describe, expect, it } from 'vitest';
import guide from '../../shared/guides/maize.json';
import coverage from '../../shared/guides/coverage.json';
import { guideImage } from '../src/domain/guideImages';

describe('offline guide image coverage', () => {
  it('requires a credited photo or an explicitly inventoried pending reference', () => {
    for (const entry of guide.entries) {
      const image = guideImage(entry.id);
      if (coverage.pendingPhotoEntries.includes(entry.id)) {
        expect(entry).toMatchObject({ imageStatus: 'PENDING_VERIFICATION', referenceLanguage: 'en' });
        expect(image, 'Do not label an unrelated image as this condition').toBeNull();
        continue;
      }
      expect(image, entry.id).not.toBeNull();
      if (!image) throw new Error(`Missing image for ${entry.id}`);
      expect(image.kind, entry.id).toBe('photo');
      expect(image.url, entry.id).toBeTruthy();
      expect(image.credit, entry.id).toBeTruthy();
      expect(image.source, entry.id).toMatch(/^https:\/\//);
    }
  });
});
