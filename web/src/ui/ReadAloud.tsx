import { Square, Volume2 } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { LANGS, useLang, useT } from '../i18n';
import { voiceFor } from './speech';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const subscribe = (cb: () => void) => {
  if (!supported) return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
};
let cache: SpeechSynthesisVoice[] = [];
const voices = () => {
  if (!supported) return cache;
  const v = speechSynthesis.getVoices();
  if (v.length !== cache.length) cache = v;
  return cache;
};

/**
 * Reads the screen's main text in the farmer's language. Hidden when the device has no voice
 * for that language (often the case for Shona and Ndebele): better no button than English
 * read in a Shona accent or the wrong language.
 */
export function ReadAloud({ text }: { text: string }) {
  const t = useT();
  const lang = useLang();
  const list = useSyncExternalStore(subscribe, voices, () => cache);
  const voice = voiceFor(lang, list);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if (supported) speechSynthesis.cancel(); }, []);
  useEffect(() => { if (supported) speechSynthesis.cancel(); setSpeaking(false); }, [text, lang]);
  if (!supported || !voice || !text.trim()) return <span className="icon-spacer" />;

  const toggle = () => {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || LANGS[lang].locale;
    u.rate = 0.92;
    u.onend = u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <button className="icon-btn icon-btn-solid" aria-pressed={speaking} aria-label={speaking ? t('readAloud.stop') : t('readAloud.play')} onClick={toggle}>
      {speaking ? <Square size={18} strokeWidth={2.5} /> : <Volume2 size={19} strokeWidth={2.25} />}
    </button>
  );
}
