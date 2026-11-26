import { describe, expect, it } from 'vitest';
import guide from '../../shared/guides/maize.json';
import coverage from '../../shared/guides/coverage.json';
import { guideImage } from '../src/domain/guideImages';

describe('offline guide image coverage', () => {
  it('resolves a credited real photo for every maize reference with no pending gaps', () => {
    expect(coverage.pendingPhotoEntries).toEqual([]);
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
  it('keeps the two published symptom panels distinct and within the source figure', () => {
    const seedling=guideImage('seedling_disease')!, roots=guideImage('root_rot')!;
    expect(seedling.crop).not.toEqual(roots.crop);
    for (const image of [seedling,roots]) {
      const c=image.crop!;
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x+c.width).toBeLessThanOrEqual(c.sourceWidth);
      expect(c.y+c.height).toBeLessThanOrEqual(c.sourceHeight);
      expect(image.licenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    }
  });
  it('exposes explicit licensing and subject descriptions for the six added references', () => {
    for (const id of ['herbicide_injury','hail_wind_damage','cold_frost_injury','seedling_disease','root_rot','stalk_rot']) {
      const image=guideImage(id)!;
      expect(image.licenseUrl,id).toMatch(/^https:\/\//);
      expect(image.description,id).toBeTruthy();
      expect(image.credit,id).not.toMatch(/Noncommercial|BY-NC/);
    }
  });
});
