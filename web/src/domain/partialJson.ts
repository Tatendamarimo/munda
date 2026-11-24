import type { Likelihood } from './models';

type Frame = { kind: 'obj' | 'arr'; expect: 'key' | 'colon' | 'value' | 'comma' };

const closers = (stack: Frame[]) => stack.map((f) => (f.kind === 'obj' ? '}' : ']')).reverse().join('');

/**
 * Best-effort parse of the start of a JSON object, for showing a model's answer while it's still
 * being written. Closes open strings, arrays and objects; drops a key with no value yet and any
 * unfinished number or literal. Returns null until something parses. Display only: the finished
 * text still goes through the strict parser.
 */
export function parsePartialJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const stack: Frame[] = [];
  let safe = { end: start, stack: [] as Frame[] };
  const mark = (end: number) => { safe = { end, stack: stack.map((f) => ({ ...f })) }; };
  let inString = false;
  let stringIsValue = false;
  let stringStart = 0;

  const afterValue = () => { const top = stack[stack.length - 1]; if (top) top.expect = 'comma'; };

  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === '"') {
        inString = false;
        const top = stack[stack.length - 1]!;
        if (stringIsValue) { afterValue(); mark(i + 1); } else top.expect = 'colon';
      }
      continue;
    }
    const top = stack[stack.length - 1];
    if (c === '"') {
      inString = true;
      stringStart = i;
      stringIsValue = !top || top.kind === 'arr' || top.expect === 'value';
    } else if (c === '{' || c === '[') {
      stack.push({ kind: c === '{' ? 'obj' : 'arr', expect: c === '{' ? 'key' : 'value' });
      mark(i + 1);
    } else if (c === '}' || c === ']') {
      stack.pop();
      afterValue();
      mark(i + 1);
      if (stack.length === 0) break;
    } else if (c === ':') {
      if (top) top.expect = 'value';
    } else if (c === ',') {
      // A bare number or literal ends here; everything before the comma is complete.
      if (top?.expect === 'value' || top?.expect === 'comma') mark(i);
      if (top) top.expect = top.kind === 'obj' ? 'key' : 'value';
    } else if (!/\s/.test(c) && top?.expect === 'value') {
      top.expect = 'comma'; // inside a bare token; only a following comma or closer makes it safe
    }
  }

  let candidate: string;
  if (inString && stringIsValue) {
    // Show the string written so far, minus a half-finished escape.
    const body = text.slice(stringStart).replace(/\\u[0-9a-fA-F]{0,3}$|\\$/, '');
    candidate = text.slice(start, stringStart) + body + '"' + closers(stack);
  } else {
    candidate = text.slice(start, safe.end) + closers(safe.stack);
  }
  try {
    return JSON.parse(candidate);
  } catch {
    try { return JSON.parse(text.slice(start, safe.end) + closers(safe.stack)); } catch { return null; }
  }
}

export interface LiveCause { guideId: string | null; name: string | null; likelihood: Likelihood | null; supporting: string[]; against: string[] }
export interface LivePreview { summary: string | null; causes: LiveCause[] }

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);
const LIKELIHOODS: readonly string[] = ['LOW', 'MEDIUM', 'HIGH'];

/** What the result screen can show of a record that's still being written. */
export function livePreview(text: string): LivePreview {
  const v = parsePartialJson(text);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { summary: null, causes: [] };
  const o = v as Record<string, unknown>;
  const causes = Array.isArray(o.possibleCauses)
    ? o.possibleCauses.filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null).map((c) => ({
        guideId: str(c.guideId),
        name: str(c.name),
        likelihood: typeof c.likelihood === 'string' && LIKELIHOODS.includes(c.likelihood) ? (c.likelihood as Likelihood) : null,
        supporting: strs(c.supporting),
        against: strs(c.againstOrMissing),
      }))
    : [];
  return { summary: str(o.summary), causes };
}
