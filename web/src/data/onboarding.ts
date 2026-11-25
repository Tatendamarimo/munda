import { Store } from './store';
const KEY = 'munda.onboarding.v1';
export type SetupStep = 'language' | 'account' | 'name' | 'area' | 'readiness';
export const SETUP_STEPS: SetupStep[] = ['language', 'account', 'name', 'area', 'readiness'];
export interface SetupState { step: SetupStep; completedUids: string[] }
export function parseSetup(raw: string | null): SetupState {
  try {
    const data = JSON.parse(raw ?? '{}');
    return { step: SETUP_STEPS.includes(data.step) ? data.step : 'language', completedUids: Array.isArray(data.completedUids) ? data.completedUids.filter((s: unknown): s is string => typeof s === 'string').slice(-20) : [] };
  } catch { return { step: 'language', completedUids: [] }; }
}
const read = () => { try { return parseSetup(localStorage.getItem(KEY)); } catch { return parseSetup(null); } };
export const onboarding = new Store<SetupState>(read());
function save(next: SetupState) { onboarding.set(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* current session still works */ } }
export function setSetupStep(step: SetupStep) { save({ ...onboarding.value, step }); }
export function finishSetup(uid: string) { save({ step: 'language', completedUids: [...onboarding.value.completedUids.filter((s) => s !== uid), uid].slice(-20) }); }
export const setupComplete = (state: SetupState, uid: string) => state.completedUids.includes(uid);
