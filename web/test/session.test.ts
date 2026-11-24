import { describe, expect, it } from 'vitest';
import { orgFor } from '../src/data/session';

describe('which farm a user is in', () => {
  it('a farmer on their own gets a private farm', () => {
    expect(orgFor('abc123', undefined)).toBe('u-abc123');
    expect(orgFor('abc123', '')).toBe('u-abc123');
  });
  it('a cooperative member uses the org an admin set', () => {
    expect(orgFor('abc123', 'wedza-coop')).toBe('wedza-coop');
  });
  it('moves people off the old shared "demo" farm', () => {
    expect(orgFor('abc123', 'demo')).toBe('u-abc123');
  });
});
