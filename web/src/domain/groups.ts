import type { Observation, PatternKind } from './models';

/**
 * Groups: an extension officer's cooperative. The group's id is its join code (`g-` + 6 letters
 * and digits, no 0/O/1/I to read aloud safely); Firestore rules check the same pattern.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newGroupId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'g-' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const normalizeCode = (input: string) => 'g-' + input.toUpperCase().replace(/^G-/, '').replace(/[^A-Z0-9]/g, '');
export const isGroupId = (id: string) => /^g-[A-Z2-9]{6}$/.test(id);

/** A square about 5 km across (0.05 degrees), so a report can't point at a farm. */
export function coarseCell(lat: number, lng: number): string {
  const r = (x: number) => (Math.round(x * 20) / 20).toFixed(2);
  return `${r(lat)},${r(lng)}`;
}

export interface AreaProblem {
  problem: string;
  area: string;
  /** Different farms reporting it: what an alert is about. */
  farms: number;
  checks: number;
  worsening: number;
  cells: string[];
  lastAt: number;
}

const WEEK = 7 * 86_400_000;
const RAISING: ReadonlySet<PatternKind> = new Set(['WORSENING', 'SPREADING']);

/** This week's checks grouped by leading cause and area, most farms first: the officer's picture. */
export function areaSummary(observations: Observation[], now: number, windowMs = WEEK): AreaProblem[] {
  const map = new Map<string, AreaProblem & { owners: Set<string> }>();
  for (const o of observations) {
    if (now - o.createdAtMillis > windowMs) continue;
    const lead = o.record?.possibleCauses[0];
    if (!lead) continue;
    const problem = lead.guideId ?? lead.name;
    const area = o.area?.trim() || '';
    const key = `${problem}|${area.toLowerCase()}`;
    const e = map.get(key) ?? { problem, area, farms: 0, checks: 0, worsening: 0, cells: [], lastAt: 0, owners: new Set<string>() };
    e.owners.add(o.ownerUid);
    e.farms = e.owners.size;
    e.checks += 1;
    if (o.review?.patterns.some((p) => RAISING.has(p.kind))) e.worsening += 1;
    if (o.cell && !e.cells.includes(o.cell)) e.cells.push(o.cell);
    e.lastAt = Math.max(e.lastAt, o.createdAtMillis);
    map.set(key, e);
  }
  return [...map.values()]
    .map(({ owners: _o, ...rest }) => rest)
    .sort((a, b) => b.farms - a.farms || b.checks - a.checks || b.lastAt - a.lastAt);
}
