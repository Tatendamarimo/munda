import type { SymptomGuide } from './guide';
import type { FieldRecord, FollowUpQuestion, Pattern, PossibleCause } from './models';
import { Likelihood, PatternKind, Urgency } from './models';

/**
 * Model output is untrusted. Parse leniently (small on-device models sometimes wrap JSON in
 * fences or add fields), validate strictly, and enforce the uncertainty rules in code so they
 * hold even when a model ignores the prompt:
 *  - "Likely" needs at least MIN_SUPPORT_FOR_HIGH supporting observations.
 *  - At most one cause can be "Likely".
 *  - Every cause says what to check next.
 *  - Guide ids and history references must be ones we actually sent.
 * Mirrors ModelOutputParser.kt on Android.
 */

export const NOT_SURE = 'Not sure';
export const DEFAULT_UNCERTAINTY =
  'These are possible causes based on what you described, not a diagnosis. Check them in the field before spending money on inputs.';

const MIN_SUPPORT_FOR_HIGH = 2;
const MAX = { questions: 2, options: 4, optionLen: 40, question: 140, summary: 280, item: 120, check: 240, note: 400, related: 10 };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

export function extractJsonObject(raw: string | null | undefined): string {
  if (raw == null) throw new Error('Empty model response');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model response');
  return raw.slice(start, end + 1);
}

function parseObject(raw: string | null | undefined): Record<string, unknown> {
  const v: unknown = JSON.parse(extractJsonObject(raw));
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('Model response is not an object');
  return v as Record<string, unknown>;
}

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

function cleanList(v: unknown, maxLen: number, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = clean(item, maxLen);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];

function causes(raw: unknown, guide: SymptomGuide, allowed: Set<string>, max: number): PossibleCause[] {
  const parsed: PossibleCause[] = [];
  const seen = new Set<string>();
  for (const c of asArray(raw)) {
    const gid = typeof c.guideId === 'string' && allowed.has(c.guideId.trim()) ? c.guideId.trim() : null;
    const entry = guide.get(gid);
    const name = clean(c.name, MAX.item) || entry?.name;
    if (!name) continue;
    const check = clean(c.checkNext, MAX.check) || entry?.checkInField;
    if (!check) continue;
    const supporting = cleanList(c.supporting, MAX.item, 4);
    let likelihood = Likelihood.parseLoose(c.likelihood);
    if (likelihood === 'HIGH' && supporting.length < MIN_SUPPORT_FOR_HIGH) likelihood = 'MEDIUM';
    const key = gid ?? name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({ guideId: gid, name, likelihood, supporting, againstOrMissing: cleanList(c.againstOrMissing, MAX.item, 4), checkNext: check });
  }
  // Only one cause may be "Likely": keep the best supported, downgrade the rest.
  parsed.sort((a, b) => Likelihood.rank(b.likelihood) - Likelihood.rank(a.likelihood) || b.supporting.length - a.supporting.length);
  let seenHigh = false;
  return parsed
    .map((c) => {
      if (c.likelihood !== 'HIGH') return c;
      if (seenHigh) return { ...c, likelihood: 'MEDIUM' as const };
      seenHigh = true;
      return c;
    })
    .slice(0, max);
}

export function parseQuestions(raw: string | null | undefined): Result<FollowUpQuestion[]> {
  try {
    const out: FollowUpQuestion[] = [];
    const seen = new Set<string>();
    for (const q of asArray(parseObject(raw).questions)) {
      const text = clean(q.text, MAX.question);
      if (text.length < 8 || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      const options = cleanList(q.options, MAX.optionLen, MAX.options);
      out.push({ text, options: options.length >= 2 ? [...options, NOT_SURE] : ['Yes', 'No', NOT_SURE] });
      if (out.length >= MAX.questions) break;
    }
    return ok(out);
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e));
  }
}

export function parseRecord(raw: string | null | undefined, guide: SymptomGuide, allowed: Set<string>, maxCauses = 3): Result<FieldRecord> {
  try {
    const o = parseObject(raw);
    const summary = clean(o.summary, MAX.summary);
    if (!summary) return fail('Model returned no summary');
    const cs = causes(o.possibleCauses, guide, allowed, maxCauses);
    if (cs.length === 0) return fail('Model returned no possible causes');
    return ok({
      summary,
      symptoms: cleanList(o.symptoms, MAX.item, 5),
      possibleCauses: cs,
      urgency: Urgency.parseLoose(o.urgency),
      uncertaintyNote: clean(o.uncertaintyNote, MAX.note) || DEFAULT_UNCERTAINTY,
    });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e));
  }
}

export interface ReviewParts {
  summary: string;
  patterns: Pattern[];
  updatedCauses: PossibleCause[];
  nextChecks: string[];
}

export function parseReview(raw: string | null | undefined, knownIds: Set<string>, guide: SymptomGuide): Result<ReviewParts> {
  try {
    const o = parseObject(raw);
    const patterns: Pattern[] = [];
    for (const p of asArray(o.patterns)) {
      const s = clean(p.summary, MAX.note);
      if (!s) continue;
      const ids = Array.isArray(p.relatedIds) ? p.relatedIds.filter((x): x is string => typeof x === 'string' && knownIds.has(x)) : [];
      patterns.push({ kind: PatternKind.parse(p.kind), summary: s, relatedIds: [...new Set(ids)].slice(0, MAX.related), source: 'CLOUD_AI' });
      if (patterns.length >= 3) break;
    }
    return ok({
      summary: clean(o.summary, MAX.note),
      patterns,
      updatedCauses: causes(o.updatedCauses, guide, new Set(guide.entries.map((e) => e.id)), 4),
      nextChecks: cleanList(o.nextChecks, MAX.check, 4),
    });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e));
  }
}
