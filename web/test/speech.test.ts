import { describe, expect, it } from 'vitest';
import { voiceFor } from '../src/ui/speech';

describe('read-aloud voice', () => {
  it('has no voice for a language the device lacks', () => {
    expect(voiceFor('sn', [{ lang: 'en-US', name: 'a' }])).toBeNull();
  });
  it('matches by primary language', () => {
    expect(voiceFor('pt', [{ lang: 'pt-BR', name: 'b' }])).toEqual({ lang: 'pt-BR', name: 'b' });
  });
  it('prefers the exact locale', () => {
    expect(voiceFor('es', [{ lang: 'es-ES', name: 'd' }, { lang: 'es-MX', name: 'c' }])?.name).toBe('c');
  });
  it('accepts underscore-style tags', () => {
    expect(voiceFor('sw', [{ lang: 'sw_KE', name: 'e' }])?.name).toBe('e');
  });
});
