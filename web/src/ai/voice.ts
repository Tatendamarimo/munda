import { getGenerativeModel, InferenceMode, type GenerativeModel } from 'firebase/ai';
import { firebase } from '../data/firebase';
import { settings } from '../data/settings';

/**
 * A natural voice for read-aloud: Gemini text-to-speech through Firebase AI Logic when online.
 * Offline, ReadAloud falls back to the device's own voice. The cloud voice also reads languages
 * the device has no voice for.
 */

export const speechPrompt = (text: string) =>
  `Read this aloud to a farmer, warmly and slowly, like a kind extension officer standing in the field. Read every word exactly as written, including headings, numbers and the final sentence. Do not summarize, skip, translate or add words. Say only the text:\n\n${text}`;

export const sampleRateOf = (mime: string) => Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);

/** Gemini TTS returns 16-bit little-endian mono PCM. */
export function pcmFromBase64(b64: string): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length >> 1);
  for (let i = 0; i < out.length; i++) {
    const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    out[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return out;
}

export interface Speech { samples: Float32Array; rate: number }

/** Retain every audio part; refuse explicitly truncated or blocked generations. */
export function completeSpeech(parts: readonly { mimeType: string; data: string }[], finishReason?: string): Speech | null {
  if (finishReason && finishReason !== 'STOP') throw new Error(`Incomplete speech response: ${finishReason}`);
  const audio = parts.filter(p => p.mimeType.startsWith('audio/'));
  if (!audio.length) return null;
  const rate = sampleRateOf(audio[0]!.mimeType);
  if (audio.some(p => sampleRateOf(p.mimeType) !== rate)) throw new Error('Speech sample rates differ');
  const decoded = audio.map(p => pcmFromBase64(p.data));
  const samples = new Float32Array(decoded.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of decoded) { samples.set(part, at); at += part.length; }
  if (!samples.length) throw new Error('Speech response is empty');
  return { samples, rate };
}

let model: GenerativeModel | null = null;
const cache = new Map<string, Promise<Speech>>();
const MAX_CACHED = 12;

/** Speech for a text, cached so replaying a screen is instant. Rejects if the cloud call fails. */
export function cloudSpeech(text: string): Promise<Speech> {
  const hit = cache.get(text);
  if (hit) return hit;
  model ??= getGenerativeModel(firebase().ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: settings.ttsModel,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.ttsVoice } } },
      },
    },
  });
  const m = model;
  const once = async (): Promise<Speech | null> => {
    const res = await m.generateContent(speechPrompt(text), { timeout: 30_000 });
    return completeSpeech(res.response.inlineDataParts()?.map(p => p.inlineData) ?? [], res.response.candidates?.[0]?.finishReason);
  };
  // The preview voice model now and then answers without audio; one retry fixes it.
  const p = once().then(async (s) => s ?? (await once()) ?? Promise.reject(new Error('No audio in the response')));
  p.catch(() => cache.delete(text));
  cache.set(text, p);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return p;
}
