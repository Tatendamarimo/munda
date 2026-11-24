import { LANGS, type Lang } from '../i18n/langs';

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name'> & { localService?: boolean };

const norm = (tag: string) => tag.replace('_', '-').toLowerCase();

/** macOS joke and effect voices: never read farming advice in these. */
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|organ|pipe organ|ralph|superstar|trinoids|whisper|wobble|zarvox)\b/i;
/** Neural / higher-quality voices, by the names browsers and systems give them. */
const NATURAL = /natural|neural|premium|enhanced|online|siri/i;

const quality = (v: VoiceLike) => (NATURAL.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : 1);

/**
 * The most natural device voice for a language, or null if there's none. Quality first
 * (neural/premium voices), then the exact locale; novelty voices are never chosen. Offline,
 * only voices stored on the device (Chrome's Google voices are streamed from a server).
 */
export function voiceFor<V extends VoiceLike>(lang: Lang, voices: readonly V[], { offline = false } = {}): V | null {
  const locale = norm(LANGS[lang].locale);
  let best: V | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const tag = norm(v.lang);
    if (tag.split('-')[0] !== lang || NOVELTY.test(v.name) || (offline && v.localService === false)) continue;
    const score = quality(v) * 10 + (tag === locale ? 1 : 0);
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}
