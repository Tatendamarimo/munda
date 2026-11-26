import type { GuideEntry } from './guide';
import type { LocalizedEntry } from './localize';
import type { MessageKey } from '../i18n/en';

/** Short sequential passages avoid browser utterance limits and long TTS responses. */
export function speechChunks(text: string, limit = 600): string[] {
  if (limit < 1) throw new Error('Speech chunk limit must be positive');
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const prefix = rest.slice(0, limit + 1);
    const sentence = [...prefix.matchAll(/[.!?。！？]\s+/g)].pop();
    const boundary = sentence && sentence.index! > limit / 3 ? sentence.index! + sentence[0].length : prefix.lastIndexOf(' ');
    const end = boundary > 0 ? Math.min(boundary, limit) : limit;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Keep speech aligned with all substantive text visible on the guide page. */
export function guideReading(entry: GuideEntry, local: LocalizedEntry, t: (key: MessageKey) => string): string {
  return [local.name, t('guide.signs'), local.signs,
    entry.report ? t('guide.report') : '', t('guide.check'), local.checkInField,
    ...([['guide.byStage', entry.byStage], ['guide.likelyWhen', entry.likelyWhen], ['guide.actNow', entry.actNow], ['guide.prevent', entry.prevent]] as const).flatMap(([key, value]) => value ? [t(key), value] : []),
    ...(entry.sources?.length ? [t('guide.sources'), ...entry.sources.map(s => s.title), t('guide.unchecked')] : []),
  ].filter(Boolean).join('. ');
}
