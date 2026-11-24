import { describe, expect, it } from 'vitest';
import { withFallback } from '../src/ai/fallback';

describe('cloud fallback model', () => {
  it('uses the main model when it answers', async () => {
    const calls: string[] = [];
    const out = await withFallback(async (m) => { calls.push(m); return `answer from ${m}`; }, 'main', 'lite');
    expect(out).toBe('answer from main');
    expect(calls).toEqual(['main']);
  });

  it('tries the fallback once when the main model fails (overloaded, timeout)', async () => {
    const calls: string[] = [];
    const out = await withFallback(async (m) => { calls.push(m); if (m === 'main') throw new Error('[500] high demand'); return 'from lite'; }, 'main', 'lite');
    expect(out).toBe('from lite');
    expect(calls).toEqual(['main', 'lite']);
  });

  it('reports the main error if the fallback fails too', async () => {
    await expect(withFallback(async (m) => { throw new Error(`${m} down`); }, 'main', 'lite')).rejects.toThrow('main down');
  });

  it('does not retry the same model', async () => {
    const calls: string[] = [];
    await expect(withFallback(async (m) => { calls.push(m); throw new Error('x'); }, 'main', 'main')).rejects.toThrow();
    expect(calls).toEqual(['main']);
  });
});
