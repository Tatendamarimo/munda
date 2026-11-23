/** The observation flow, one question per screen. Pure so the order is unit-tested. */
export type ObserveStep = 'describe' | 'plot' | 'area' | 'rain' | 'onset' | 'followups' | 'result';

const ALL: ObserveStep[] = ['describe', 'plot', 'area', 'rain', 'onset', 'followups', 'result'];

export const stepsFor = (hasFollowUps: boolean): ObserveStep[] => (hasFollowUps ? ALL : ALL.filter((s) => s !== 'followups'));

export function nextStep(cur: ObserveStep, hasFollowUps: boolean): ObserveStep | null {
  const s = stepsFor(hasFollowUps);
  return s[s.indexOf(cur) + 1] ?? null;
}

export function prevStep(cur: ObserveStep, hasFollowUps: boolean): ObserveStep | null {
  const s = stepsFor(hasFollowUps);
  const i = s.indexOf(cur);
  return i > 0 ? s[i - 1]! : null;
}
