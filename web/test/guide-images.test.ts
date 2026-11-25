import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import guide from '../../shared/guides/maize.json';
import images from '../../shared/guides/images/maize.json';

describe('offline guide image coverage', () => {
  it('bundles a JPEG with a valid header and a credit record for every maize entry', () => {
    for (const entry of guide.entries) {
      const image = (images as Record<string, { file: string; kind: string; author?: string; license?: string; source?: string }>)[entry.id];
      expect(image, entry.id).toBeDefined();
      const path = fileURLToPath(new URL(`../../shared/guides/images/maize/${image.file}`, import.meta.url));
      expect(existsSync(path), entry.id).toBe(true);
      const bytes = readFileSync(path);
      expect([...bytes.subarray(0, 3)], entry.id).toEqual([0xff, 0xd8, 0xff]);
      if (image.kind === 'photo') {
        expect(image.author, entry.id).toBeTruthy();
        expect(image.license, entry.id).toBeTruthy();
        expect(image.source, entry.id).toMatch(/^https:\/\//);
      }
    }
  });
});
