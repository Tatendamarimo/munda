import { describe, expect, it } from 'vitest';
import { pcmFromBase64, sampleRateOf, speechPrompt } from '../src/ai/voice';

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
