import { useSyncExternalStore } from 'react';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { DetailPage } from './DetailPage';
import { HomePage } from './HomePage';
import { ObservePage } from './ObservePage';
import { Placeholder } from './Placeholder';
import { tabOf, useRoute, type Route } from './router';
import { TabBar } from './TabBar';
import { Welcome } from './Welcome';

const wideQuery = '(min-width: 960px)';
const useWide = () =>
  useSyncExternalStore(
    (cb) => { const m = matchMedia(wideQuery); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(wideQuery).matches,
  );

function screenFor(r: Route) {
  switch (r.name) {
    case 'home': return <HomePage />;
    case 'observe': return <div className="page"><ObservePage key="observe" /></div>;
    case 'record': return <div className="page"><DetailPage key={r.id} id={r.id} /></div>;
    case 'plots': case 'plot': case 'guide': case 'guideEntry': case 'me': return <Placeholder route={r} />;
  }
}

/**
 * Phones: one screen plus the bottom tab bar (hidden in the observation flow, which is a focused
 * sequence). Wide screens: the same tabs as a left rail, so a cooperative's laptop gets the same app.
 */
export function Shell() {
  const s = useStore(session);
  const route = useRoute();
  const wide = useWide();
  if (s.kind !== 'ready') return <Welcome state={s} />;

  const tab = tabOf(route);
  const flow = tab === null;
  return (
    <div className={`app${wide ? ' app-wide' : ''}`}>
      {(wide || !flow) && <TabBar active={tab} />}
      <main className={flow && !wide ? 'screen screen-flow' : 'screen'}>{screenFor(route)}</main>
    </div>
  );
}
