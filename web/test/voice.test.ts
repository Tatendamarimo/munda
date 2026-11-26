import { describe, expect, it } from 'vitest';
import { completeSpeech, pcmFromBase64, sampleRateOf, speechPrompt } from '../src/ai/voice';

describe('cloud voice audio', () => {
  it('reads the sample rate from the mime type', () => {
    expect(sampleRateOf('audio/L16;codec=pcm;rate=24000')).toBe(24000);
    expect(sampleRateOf('audio/L16; rate=16000')).toBe(16000);
    expect(sampleRateOf('audio/L16')).toBe(24000);
  });

  it('decodes 16-bit little-endian PCM to floats', () => {
    // 0, 16384 (0.5), -32768 (-1)
    const b64 = btoa(String.fromCharCode(0x00, 0x00, 0x00, 0x40, 0x00, 0x80));
    expect(Array.from(pcmFromBase64(b64))).toEqual([0, 0.5, -1]);
  });

  it('asks for a calm, slow reading and keeps the text intact', () => {
    const p = speechPrompt('Nitrogen deficiency. Compare lower and upper leaves.');
    expect(p).toContain('Nitrogen deficiency. Compare lower and upper leaves.');
    expect(p.toLowerCase()).toContain('slowly');
  });
});

describe('complete cloud audio',()=>{
  const pcm=btoa(String.fromCharCode(0,64));
  it('joins every audio part instead of stopping at the first',()=>{
    const result=completeSpeech([{mimeType:'audio/L16;rate=24000',data:pcm},{mimeType:'audio/L16;rate=24000',data:pcm}], 'STOP');
    expect(Array.from(result!.samples)).toEqual([0.5,0.5]);
  });
  it('rejects a truncated or blocked generation',()=>{
    for(const reason of ['MAX_TOKENS','SAFETY']) expect(()=>completeSpeech([{mimeType:'audio/L16',data:pcm}],reason)).toThrow('Incomplete speech');
  });
  it('rejects inconsistent rates and empty audio',()=>{
    expect(()=>completeSpeech([{mimeType:'audio/L16;rate=24000',data:pcm},{mimeType:'audio/L16;rate=16000',data:pcm}])).toThrow('sample rates');
    expect(()=>completeSpeech([{mimeType:'audio/L16',data:''}])).toThrow('empty');
    expect(completeSpeech([])).toBeNull();
  });
});
