import { guideFor } from '../domain/guide';
import { localizedEntry } from '../domain/localize';
import type { Lang } from '../i18n';
import type { MessageKey } from '../i18n/en';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * An officer's confirmed alert in the reader's own language, from its stored problem, area and
 * count (the stored message is the officer's language, kept only as a fallback).
 * Mirrored by Android's alertText.
 */
export function alertText(t: T, lang: Lang, a: { problem: string; area: string | null; count: number }): string {
  const e = guideFor('MAIZE').get(a.problem);
  const problem = e ? localizedEntry(e, lang).name : a.problem;
  const area = a.area || t('area.noArea');
  return a.count === 1 ? t('area.alertMessageOne', { problem, area }) : t('area.alertMessage', { problem, n: a.count, area });
}
