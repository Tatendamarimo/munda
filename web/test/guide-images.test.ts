import { describe, expect, it } from 'vitest';
import guide from '../../shared/guides/maize.json';
import { guideImage } from '../src/domain/guideImages';

describe('offline guide image coverage', () => {
  it('resolves a bundled real photo and credits for every maize entry', () => {
    for (const entry of guide.entries) {
      const image = guideImage(entry.id);
      expect(image, entry.id).not.toBeNull();
      if (!image) throw new Error(`Missing image for ${entry.id}`);
      expect(image.kind, entry.id).toBe('photo');
      expect(image.url, entry.id).toBeTruthy();
      expect(image.credit, entry.id).toBeTruthy();
      expect(image.source, entry.id).toMatch(/^https:\/\//);
    }
  });
});
