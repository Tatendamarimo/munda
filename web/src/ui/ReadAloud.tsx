import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cloudSpeech } from '../ai/voice';
import { speechChunks } from '../domain/reading';
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
let activeStop: (() => void) | null = null;
type State = 'idle' | 'loading' | 'playing';

/** Reads every passage in order. Stop, navigation and language changes cancel pending playback. */
export function ReadAloud({ text, prefetch = false }: { text: string; prefetch?: boolean }) {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  const list = useSyncExternalStore(subscribe, voices, () => cache);
  const voice = voiceFor(lang, list, { offline: !online });
  const [state, setState] = useState<State>('idle');
  const run = useRef(0);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelWait = useRef<(() => void) | null>(null);
  const stop = () => {
    run.current++;
    cancelWait.current?.(); cancelWait.current = null;
    try { source.current?.stop(); } catch { /* already stopped */ }
    source.current = null;
    utterance.current = null;
    if (activeStop === owner.current) {
      if (supported) speechSynthesis.cancel();
      activeStop = null;
    }
    setState('idle');
  };
  // Refs keep the current callback without changing the playback owner on re-render.
  const stopRef = useRef(stop); stopRef.current = stop;
  const owner = useRef(() => stopRef.current());
  useEffect(() => () => { if (activeStop === owner.current) activeStop = null; run.current++; cancelWait.current?.(); try { source.current?.stop(); } catch { /* ended */ } if (utterance.current && supported) speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (prefetch && online && text.trim()) void cloudSpeech(speechChunks(text)[0]!).catch(() => {});
  }, [prefetch, online, text]);
  useEffect(() => { owner.current(); }, [text, lang]);

  const devicePassage = async (passage: string, id: number) => {
    if (!supported || !voice || id !== run.current) throw new Error('No device voice available');
    for (const chunk of speechChunks(passage, 160)) {
      if (id !== run.current) return;
      await new Promise<void>((resolve, reject) => {
        const u = new SpeechSynthesisUtterance(chunk);
        utterance.current = u;
        u.voice = voice; u.lang = voice.lang || LANGS[lang].locale; u.rate = 0.92;
        cancelWait.current = resolve;
        u.onend = () => { utterance.current = null; resolve(); };
        u.onerror = (e) => reject(new Error(e.error));
        setState('playing'); speechSynthesis.speak(u);
      });
    }
  };
  const start = async () => {
    activeStop?.(); activeStop = owner.current;
    const id = ++run.current;
    if (supported) speechSynthesis.cancel();
    // Unlock audio in the user's click, before awaiting model output.
    try { if (online) { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } } catch { /* device voice remains available */ }
    try {
      for (const chunk of speechChunks(text)) {
        if (id !== run.current) return;
        if (!online || !audio) { await devicePassage(chunk, id); continue; }
        setState('loading');
        let speech;
        try { speech = await cloudSpeech(chunk); }
        catch (e) { console.warn('Cloud voice failed; using device voice', e); if (id === run.current) await devicePassage(chunk, id); continue; }
        if (id !== run.current) return;
        const context = audio;
        await new Promise<void>((resolve, reject) => {
          const buf = context.createBuffer(1, speech.samples.length, speech.rate);
          buf.copyToChannel(speech.samples as Float32Array<ArrayBuffer>, 0);
          const node = context.createBufferSource(); node.buffer = buf; node.connect(context.destination);
          source.current = node; cancelWait.current = resolve;
          node.onended = () => { node.disconnect(); resolve(); };
          try { node.start(); setState('playing'); } catch (e) { reject(e); }
        });
      }
    } catch (e) { if (id === run.current) console.warn('Read aloud interrupted', e); }
    finally { if (id === run.current) { activeStop = null; setState('idle'); } }
  };
  if (!text.trim() || (!online && !voice)) return <span className="icon-spacer" />;
  const busy = state !== 'idle';
  return <button className="icon-btn icon-btn-solid" aria-pressed={busy} aria-busy={state === 'loading'} aria-label={busy ? t('readAloud.stop') : t('readAloud.play')} onClick={() => busy ? owner.current() : void start()}>
    {state === 'loading' ? <LoaderCircle className="spin" size={19} strokeWidth={2.25} /> : state === 'playing' ? <Square size={18} strokeWidth={2.5} /> : <Volume2 size={19} strokeWidth={2.25} />}
  </button>;
}
