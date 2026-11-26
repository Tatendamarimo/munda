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
  if (v.length !== cache.length || v.some((x, i) => x.name !== cache[i]?.name || x.lang !== cache[i]?.lang || x.localService !== cache[i]?.localService || x.voiceURI !== cache[i]?.voiceURI)) cache = v;
  return cache;
};
let audio: AudioContext | null = null;
let activeStop: (() => void) | null = null;
type State = 'idle' | 'loading' | 'playing';

/** Prefer literal device speech; generative cloud audio is a fallback, never a summary. */
export function ReadAloud({ text, prefetch = false }: { text: string; prefetch?: boolean }) {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  const list = useSyncExternalStore(subscribe, voices, () => cache);
  const voice = voiceFor(lang, list, { offline: true }) ?? voiceFor(lang, list, { offline: !online });
  const [state, setState] = useState<State>('idle');
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(0);
  const run = useRef(0);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelWait = useRef<(() => void) | null>(null);
  const passages = speechChunks(text, 140);
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
  const stopRef = useRef(stop); stopRef.current = stop;
  const owner = useRef(() => stopRef.current());
  useEffect(() => () => {
    if (activeStop === owner.current) activeStop = null;
    run.current++; cancelWait.current?.();
    try { source.current?.stop(); } catch { /* ended */ }
    if (utterance.current && supported) speechSynthesis.cancel();
  }, []);
  useEffect(() => {
    if (prefetch && online && !voice && text.trim()) void cloudSpeech(speechChunks(text, 140)[0]!).catch(() => {});
  }, [prefetch, online, text, voice]);
  useEffect(() => { owner.current(); setFailed(false); setPosition(0); }, [text, lang]);

  const devicePassage = (passage: string, id: number) => new Promise<void>((resolve, reject) => {
    if (!supported || !voice || id !== run.current) { reject(new Error('No device voice available')); return; }
    const u = new SpeechSynthesisUtterance(passage);
    utterance.current = u;
    u.voice = voice; u.lang = voice.lang || LANGS[lang].locale; u.rate = 0.92;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      u.onend = null; u.onerror = null;
      if (utterance.current === u) utterance.current = null;
      cancelWait.current = null;
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => {
      finish(new Error('Device voice did not finish the passage'));
      speechSynthesis.cancel();
    }, 30_000);
    cancelWait.current = () => finish();
    u.onend = () => finish();
    u.onerror = e => finish(new Error(e.error));
    setState('playing');
    try { speechSynthesis.speak(u); } catch (e) { finish(e instanceof Error ? e : new Error(String(e))); }
  });
  const cloudPassage = async (passage: string, id: number) => {
    if (!online || !audio) throw new Error('No voice available');
    setState('loading');
    const speech = await cloudSpeech(passage);
    if (id !== run.current) return;
    const context = audio;
    await context.resume();
    if (id !== run.current) return;
    await new Promise<void>((resolve, reject) => {
      const buf = context.createBuffer(1, speech.samples.length, speech.rate);
      buf.copyToChannel(speech.samples as Float32Array<ArrayBuffer>, 0);
      const node = context.createBufferSource(); node.buffer = buf; node.connect(context.destination);
      source.current = node;
      cancelWait.current = resolve;
      node.onended = () => { node.disconnect(); if (source.current === node) source.current = null; cancelWait.current = null; resolve(); };
      try { node.start(); setState('playing'); } catch (e) { node.disconnect(); reject(e); }
    });
  };
  const start = async () => {
    activeStop?.(); activeStop = owner.current;
    const id = ++run.current;
    setFailed(false); setPosition(0);
    if (supported) speechSynthesis.cancel();
    // Unlock the fallback while still inside the user's click.
    try { if (online) { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } } catch { /* device voice remains available */ }
    try {
      for (const [index, passage] of passages.entries()) {
        if (id !== run.current) return;
        setPosition(index + 1);
        if (voice) {
          try { await devicePassage(passage, id); }
          catch (e) { if (id !== run.current) return; console.warn('Device voice failed; trying cloud speech', e); await cloudPassage(passage, id); }
        } else await cloudPassage(passage, id);
      }
    } catch (e) { if (id === run.current) { console.warn('Read aloud interrupted', e); setFailed(true); } }
    finally { if (id === run.current) { cancelWait.current = null; activeStop = null; setState('idle'); } }
  };
  if (!text.trim() || (!online && !voice)) return <span className="icon-spacer" />;
  const busy = state !== 'idle';
  const progress = t('readAloud.progress', { current: position, total: passages.length });
  return <span className="read-aloud-control">
    <button className="icon-btn icon-btn-solid" aria-pressed={busy} aria-busy={state === 'loading'} aria-label={busy ? t('readAloud.stop') : t('readAloud.play')} title={busy ? progress : t('readAloud.play')} onClick={() => busy ? owner.current() : void start()}>
      {state === 'loading' ? <LoaderCircle className="spin" size={19} strokeWidth={2.25} /> : state === 'playing' ? <Square size={18} strokeWidth={2.5} /> : <Volume2 size={19} strokeWidth={2.25} />}
    </button>
    {busy && <span className="read-aloud-progress" role="status" aria-label={progress}>{position}/{passages.length}</span>}
    {failed && <span className="read-aloud-error" role="alert">{t('readAloud.failed')}</span>}
  </span>;
}
