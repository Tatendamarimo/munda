import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cloudSpeech } from '../ai/voice';
import { connectivity } from '../data/connectivity';
import { useStore } from '../data/store';
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

let audio: AudioContext | null = null;

type State = 'idle' | 'loading' | 'playing';

/**
 * Reads the screen's main text in the farmer's language. Hybrid, like the rest of Munda: online
 * it's a natural Gemini voice (which also covers languages the device has no voice for);
 * offline, or if that fails, the device's most natural voice. Hidden when neither is available:
 * better no button than the wrong language.
 */
export function ReadAloud({ text }: { text: string }) {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  const list = useSyncExternalStore(subscribe, voices, () => cache);
  const voice = voiceFor(lang, list, { offline: !online });
  const [state, setState] = useState<State>('idle');
  const run = useRef(0);
  const source = useRef<AudioBufferSourceNode | null>(null);

  const stop = () => {
    run.current++;
    try { source.current?.stop(); } catch { /* already stopped */ }
    source.current = null;
    if (supported) speechSynthesis.cancel();
    setState('idle');
  };
  useEffect(() => stop, []);
  useEffect(() => { stop(); }, [text, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!text.trim() || (!online && !voice)) return <span className="icon-spacer" />;

  const speakOnDevice = (id: number) => {
    if (!supported || !voice || id !== run.current) { if (id === run.current) setState('idle'); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || LANGS[lang].locale;
    u.rate = 0.92;
    u.onend = u.onerror = () => { if (id === run.current) setState('idle'); };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setState('playing');
  };

  const start = async () => {
    const id = ++run.current;
    if (!online) { speakOnDevice(id); return; }
    // Created inside the tap so the browser lets it play once the audio arrives.
    audio ??= new AudioContext();
    void audio.resume();
    setState('loading');
    try {
      const speech = await cloudSpeech(text);
      if (id !== run.current) return;
      const buf = audio.createBuffer(1, speech.samples.length, speech.rate);
      buf.copyToChannel(speech.samples as Float32Array<ArrayBuffer>, 0);
      const node = audio.createBufferSource();
      node.buffer = buf;
      node.connect(audio.destination);
      node.onended = () => { if (id === run.current) setState('idle'); };
      source.current = node;
      node.start();
      setState('playing');
    } catch (e) {
      console.warn('Cloud voice failed; using the device voice', e);
      speakOnDevice(id);
    }
  };

  const busy = state !== 'idle';
  return (
    <button className="icon-btn icon-btn-solid" aria-pressed={busy} aria-busy={state === 'loading'} aria-label={busy ? t('readAloud.stop') : t('readAloud.play')} onClick={() => (busy ? stop() : void start())}>
      {state === 'loading' ? <LoaderCircle className="spin" size={19} strokeWidth={2.25} /> : state === 'playing' ? <Square size={18} strokeWidth={2.5} /> : <Volume2 size={19} strokeWidth={2.25} />}
    </button>
  );
}
