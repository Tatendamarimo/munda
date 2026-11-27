import { decideRoute } from '../src/domain/routing';
import { describe, it, expect } from 'vitest';
import { appleRequestRoute } from '../src/ai/appleNative';
describe('Apple text-only local inference', () => {
  it('sends photos to cloud only when connected', () => {
    expect(appleRequestRoute('ON_DEVICE', true, true)).toBe('CLOUD');
    expect(appleRequestRoute('ON_DEVICE', true, false)).toBe('QUEUE_UNTIL_ONLINE');
  });
  it('keeps text local and preserves an explicit cloud or queued decision', () => {
    expect(appleRequestRoute('ON_DEVICE', false, false)).toBe('ON_DEVICE');
    expect(appleRequestRoute('CLOUD', false, true)).toBe('CLOUD');
    expect(appleRequestRoute('QUEUE_UNTIL_ONLINE', false, true)).toBe('QUEUE_UNTIL_ONLINE');
  });
});

describe('Apple photo route disclosure before submission', () => {
  it('does not promise local privacy for an online photo', () => {
    const result = decideRoute(100, 'AVAILABLE', true, 2000, { hasPhoto: true, supportsLocalImages: false });
    expect(result.route).toBe('CLOUD');
    expect(result.reason).toContain('cloud');
  });
  it('queues an offline photo even when local text AI is ready', () => {
    expect(decideRoute(100, 'AVAILABLE', false, 2000, { hasPhoto: true, supportsLocalImages: false }).route).toBe('QUEUE_UNTIL_ONLINE');
    expect(decideRoute(100, 'AVAILABLE', false, 2000, { hasPhoto: false, supportsLocalImages: false }).route).toBe('ON_DEVICE');
  });
});
