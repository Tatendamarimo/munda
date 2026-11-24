/** DEV-only visual QA. No Firebase bootstrap, network requests or live inference. */
import { createRoot } from 'react-dom/client';
import { settings } from '../data/settings';
import { session } from '../data/session';
import { connectivity } from '../data/connectivity';
import { group } from '../data/group';
import { prefs } from '../data/prefs';
import { mundaAi } from '../ai/mundaAi';
import { Shell } from '../ui/Shell';
import { Welcome } from '../ui/Welcome';
import { demoObservations } from './fixtures';
import { repository } from '../data/repository';

export function startDesignPreview(root: ReturnType<typeof createRoot>) {
  Object.defineProperty(settings, 'maxOnDeviceChars', { get: () => 6000, configurable: true });
  repository.newId = () => crypto.randomUUID();
  repository.create = (observation) => { demoObservations().unshift({ observation, synced: false }); };
  group.set(null);
  connectivity.set(false);
  mundaAi.local.set({ state: 'UNAVAILABLE', progress: null });
  session.set({ kind: 'ready', uid: 'demo', orgId: 'demo' });
  prefs.set({ ...prefs.value, name: 'Farmer', place: 'Wedza' });
  repository.observeRecent = (_org, change) => { change(demoObservations()); return () => {}; };
  repository.observe = (_org, id, change) => { change(demoObservations().find((i) => i.observation.id === id) ?? null); return () => {}; };
  const welcome = new URLSearchParams(location.search).has('welcome');
  root.render(<><div className="design-preview-banner">Sample farm · visual preview · no live AI or cloud connection</div>{welcome ? <Welcome state={{ kind: 'needsActivation' }} /> : <Shell />}</>);
}
