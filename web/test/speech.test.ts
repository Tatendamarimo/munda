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

describe('picking the most natural device voice', () => {
  it('prefers natural, premium and enhanced voices over plain ones', () => {
    const list = [
      { lang: 'en-US', name: 'Fred' },
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'en-US', name: 'Ava (Premium)' },
    ];
    expect(voiceFor('en', list)?.name).toBe('Ava (Premium)');
    expect(voiceFor('en', [{ lang: 'en-GB', name: 'Daniel' }, { lang: 'en-US', name: 'Microsoft Aria Online (Natural) - English (United States)' }])?.name).toContain('Natural');
    expect(voiceFor('en', [{ lang: 'en-US', name: 'Alex' }, { lang: 'en-US', name: 'Google US English' }])?.name).toBe('Google US English');
  });

  it('never picks a novelty voice when a real one exists', () => {
    expect(voiceFor('en', [{ lang: 'en-US', name: 'Zarvox' }, { lang: 'en-US', name: 'Bad News' }, { lang: 'en-GB', name: 'Daniel' }])?.name).toBe('Daniel');
    expect(voiceFor('en', [{ lang: 'en-US', name: 'Zarvox' }])).toBeNull();
  });

  it('still prefers the exact locale among equally good voices', () => {
    expect(voiceFor('es', [{ lang: 'es-ES', name: 'Mónica (Enhanced)' }, { lang: 'es-MX', name: 'Paulina (Enhanced)' }])?.name).toBe('Paulina (Enhanced)');
  });
});

describe('offline voices', () => {
  it('uses only voices stored on the device when offline', () => {
    const list = [{ lang: 'en-US', name: 'Google US English', localService: false }, { lang: 'en-US', name: 'Samantha', localService: true }];
    expect(voiceFor('en', list)?.name).toBe('Google US English');
    expect(voiceFor('en', list, { offline: true })?.name).toBe('Samantha');
    expect(voiceFor('en', [list[0]!], { offline: true })).toBeNull();
  });
});
