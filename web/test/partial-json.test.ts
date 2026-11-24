import { describe, expect, it } from 'vitest';
import { livePreview, parsePartialJson } from '../src/domain/partialJson';

describe('partial JSON', () => {
  it('parses complete JSON unchanged', () => {
    expect(parsePartialJson('{"a":1,"b":[true,"x"]}')).toEqual({ a: 1, b: [true, 'x'] });
  });

  it('returns null before any object starts', () => {
    expect(parsePartialJson('')).toBeNull();
    expect(parsePartialJson('```json\n')).toBeNull();
  });

  it('keeps a string value that is still being written', () => {
    expect(parsePartialJson('{"summary":"Yellow leav')).toEqual({ summary: 'Yellow leav' });
  });

  it('drops a key that has no value yet', () => {
    expect(parsePartialJson('{"summary":"Done","symp')).toEqual({ summary: 'Done' });
    expect(parsePartialJson('{"summary":"Done","symptoms":')).toEqual({ summary: 'Done' });
    expect(parsePartialJson('{"summary":"Done",')).toEqual({ summary: 'Done' });
  });

  it('closes open arrays and objects', () => {
    expect(parsePartialJson('{"possibleCauses":[{"guideId":"nitrogen_deficiency","name":"Nitro')).toEqual({
      possibleCauses: [{ guideId: 'nitrogen_deficiency', name: 'Nitro' }],
    });
    expect(parsePartialJson('{"list":["a","b')).toEqual({ list: ['a', 'b'] });
  });

  it('drops unfinished numbers and literals', () => {
    expect(parsePartialJson('{"a":"x","n":12')).toEqual({ a: 'x' });
    expect(parsePartialJson('{"a":"x","ok":tr')).toEqual({ a: 'x' });
    expect(parsePartialJson('{"a":"x","n":12,')).toEqual({ a: 'x', n: 12 });
  });

  it('handles escapes, including one cut in half', () => {
    expect(parsePartialJson('{"s":"say \\"hi\\"')).toEqual({ s: 'say "hi"' });
    expect(parsePartialJson('{"s":"a\\')).toEqual({ s: 'a' });
    expect(parsePartialJson('{"s":"a\\u00')).toEqual({ s: 'a' });
    expect(parsePartialJson('{"s":"{not [structure"')).toEqual({ s: '{not [structure' });
  });

  it('skips a code fence before the object', () => {
    expect(parsePartialJson('```json\n{"summary":"ok"')).toEqual({ summary: 'ok' });
  });
});

describe('live preview of a record being written', () => {
  it('shows the summary and causes so far', () => {
    const p = livePreview('{"summary":"Lower leaves yellow","symptoms":["yellow"],"possibleCauses":[{"guideId":"nitrogen_deficiency","name":"Nitrogen deficiency","likelihood":"HIGH"},{"guideId":"wat');
    expect(p.summary).toBe('Lower leaves yellow');
    expect(p.causes).toEqual([
      { guideId: 'nitrogen_deficiency', name: 'Nitrogen deficiency', likelihood: 'HIGH', supporting: [], against: [] },
      { guideId: 'wat', name: null, likelihood: null, supporting: [], against: [] },
    ]);
  });

  it('is empty before anything usable arrives', () => {
    expect(livePreview('')).toEqual({ summary: null, causes: [] });
    expect(livePreview('{"summ')).toEqual({ summary: null, causes: [] });
  });

  it('ignores unknown likelihood values', () => {
    expect(livePreview('{"possibleCauses":[{"name":"X","likelihood":"MED')).toEqual({ summary: null, causes: [{ guideId: null, name: 'X', likelihood: null, supporting: [], against: [] }] });
  });

  it('streams the evidence lines', () => {
    const p = livePreview('{"possibleCauses":[{"name":"X","likelihood":"LOW","supporting":["lower leaves","after ra');
    expect(p.causes[0]).toMatchObject({ supporting: ['lower leaves', 'after ra'], against: [] });
    const q = livePreview('{"possibleCauses":[{"name":"X","supporting":["a"],"againstOrMissing":["upper leaves fine"]}');
    expect(q.causes[0]).toMatchObject({ supporting: ['a'], against: ['upper leaves fine'] });
  });
});
