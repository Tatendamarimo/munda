import { LANGS, type Lang } from '../i18n/langs';

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name'>;

const norm = (tag: string) => tag.replace('_', '-').toLowerCase();

/** The device voice for a language: exact locale first, then any voice of the same language; null if none. */
export function voiceFor<V extends VoiceLike>(lang: Lang, voices: readonly V[]): V | null {
  const locale = norm(LANGS[lang].locale);
  return voices.find((v) => norm(v.lang) === locale) ?? voices.find((v) => norm(v.lang).split('-')[0] === lang) ?? null;
}
