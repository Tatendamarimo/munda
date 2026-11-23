/** Downscales a picked photo to a JPEG (base64, no data: prefix) the model accepts. */
export async function fileToJpegBase64(file: File, maxSide = 1024): Promise<{ base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), previewUrl: dataUrl };
}

// ---------- Dictation (Web Speech API) ----------

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;
const SR: Ctor | undefined =
  typeof window === 'undefined' ? undefined : ((window as unknown as Record<string, Ctor | undefined>).SpeechRecognition ?? (window as unknown as Record<string, Ctor | undefined>).webkitSpeechRecognition);

export const dictationSupported = Boolean(SR);

/**
 * Browser dictation. Note: Chrome on desktop sends audio to a speech service, so dictation needs
 * signal there; typing always works offline. Safari on iOS may recognise on-device.
 */
export function startDictation(onSegment: (text: string) => void, onPartial: (text: string) => void, onStop: (error?: string) => void): () => void {
  if (!SR) {
    onStop('Dictation isn’t supported in this browser. You can type instead.');
    return () => {};
  }
  const r = new SR();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  let error: string | undefined;
  r.onresult = (e) => {
    let partial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (!res) continue;
      if (res.isFinal) onSegment(res[0].transcript.trim());
      else partial += res[0].transcript;
    }
    onPartial(partial);
  };
  r.onerror = (e) => {
    error =
      e.error === 'network' ? 'Dictation needs signal on this device. You can type instead.'
      : e.error === 'not-allowed' ? 'Microphone permission is needed for dictation.'
      : e.error === 'no-speech' ? undefined
      : `Dictation stopped (${e.error}). You can keep typing.`;
  };
  r.onend = () => onStop(error);
  r.start();
  return () => r.stop();
}
