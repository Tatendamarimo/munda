import { lazy, Suspense, useSyncExternalStore, useEffect } from 'react';
import { useT } from '../i18n';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { ConnectionBanner } from './ConnectionBanner';
import { RecordPage } from './RecordPage';
import { HomePage } from './HomePage';
import { ObservePage } from './ObservePage';
import { GuideEntryPage, GuidePage } from './GuidePage';
import { MePage } from './MePage';
// Officers only, and it brings the map library: loaded on demand so farmers' app stays small.
const AreaPage = lazy(() => import('./AreaPage').then((m) => ({ default: m.AreaPage })));
import { PlotPage } from './PlotPage';
import { PlotsPage } from './PlotsPage';
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
    case 'record': return <RecordPage key={r.id} id={r.id} />;
    case 'plots': return <PlotsPage />;
    case 'plot': return <PlotPage key={r.key} plotKey={r.key} />;
    case 'guide': return <GuidePage />;
    case 'guideEntry': return <GuideEntryPage key={r.id} id={r.id} />;
    case 'me': return <MePage />;
    case 'area': return <Suspense fallback={null}><AreaPage /></Suspense>;
  }
}

/**
 * Phones: one screen plus the bottom tab bar (hidden in the observation flow, which is a focused
 * sequence). Wide screens: the same tabs as a left rail, so a cooperative's laptop gets the same app.
 */
export function Shell() {
  const t = useT();
  const s = useStore(session);
  const route = useRoute();
  const wide = useWide();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);
  if (s.kind !== 'ready') return <Welcome state={s} />;

  const tab = tabOf(route);
  const flow = tab === null;
  return (
    <div className={`app${wide ? ' app-wide' : ''}`}>
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>{t('studio.skip')}</a>
      {(wide || !flow) && <TabBar active={tab} />}
      <main id="main-content" tabIndex={-1} className={flow && !wide ? 'screen screen-flow' : 'screen'}>
        <ConnectionBanner />
        {screenFor(route)}
      </main>
    </div>
  );
}
