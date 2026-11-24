/**
 * What each guide problem looks like: one picture per entry in shared/guides/images/<crop>/,
 * credited in shared/guides/images/<crop>.json (the Android app reads the same files). A photo
 * carries its author and licence; a drawing is marked as one. Bundled, so they work offline.
 */
import credits from '../../../shared/guides/images/maize.json';

export interface GuideImage {
  url: string;
  kind: 'photo' | 'drawing';
  /** "Author · licence" for photos; empty for our own drawings. */
  credit: string;
  source: string | null;
}

interface CreditEntry { kind: 'photo' | 'drawing'; file: string; author?: string; license?: string; source?: string }

const files = import.meta.glob('../../../shared/guides/images/maize/*.jpg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const byFile = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!, url]));

export function guideImage(id: string): GuideImage | null {
  const c = (credits as Record<string, CreditEntry>)[id];
  const url = c && byFile.get(c.file);
  if (!c || !url) return null;
  return {
    url,
    kind: c.kind,
    credit: c.kind === 'photo' ? [c.author, c.license].filter(Boolean).join(' · ') : '',
    source: c.source ?? null,
  };
}
