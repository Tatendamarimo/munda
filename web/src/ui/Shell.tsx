import { Download, Plus, Sprout, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { mundaAi } from '../ai/mundaAi';
import { connectivity } from '../data/connectivity';
import { repository, type ObservationItem } from '../data/repository';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { Likelihood } from '../domain/models';
import { Wordmark } from './brand';
import { OriginBadge, SyncBadge, UrgencyBadge, Working } from './components';
import { DetailPage } from './DetailPage';
import { ObservePage } from './ObservePage';
import { navigate, useRoute } from './router';
import { Welcome } from './Welcome';

const wideQuery = '(min-width: 960px)';
const useWide = () =>
  useSyncExternalStore(
    (cb) => { const m = matchMedia(wideQuery); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(wideQuery).matches,
  );

/** Live list of this org's observations, shared by the sidebar and the phone home screen. */
function useObservations(): ObservationItem[] | null {
  const s = useStore(session);
  const orgId = s.kind === 'ready' ? s.orgId : null;
  const [items, setItems] = useState<ObservationItem[] | null>(null);
  useEffect(() => (orgId ? repository.observeRecent(orgId, setItems) : undefined), [orgId]);
  return items;
}

export function Shell() {
  const s = useStore(session);
  const route = useRoute();
  const wide = useWide();
  const items = useObservations();
  if (s.kind !== 'ready') return <Welcome state={s} />;

  const detail = /^\/o\/([\w-]+)$/.exec(route)?.[1];
  const selected = detail ?? null;
  const content =
    route === '/observe' ? <ObservePage key="observe" /> : detail ? <DetailPage key={detail} id={detail} /> : null;

  return (
    <div className="app">
      <header className="appbar">
        <a href="#/" className="appbar-home" aria-label="Munda home"><Wordmark /></a>
        <StatusMenu />
      </header>
      {wide ? (
        <div className="workspace">
          <aside className="sidebar" aria-label="Observations">
            <ObservationList items={items} selected={selected} />
          </aside>
          <main className="pane">{content ?? <Overview hasItems={(items?.length ?? 0) > 0} />}</main>
        </div>
      ) : content ? (
        <main className="pane">{content}</main>
      ) : (
        <main className="pane">
          <ObservationList items={items} selected={null} />
          <button className="fab" onClick={() => navigate('/observe')}><Plus size={20} strokeWidth={2.5} aria-hidden="true" />New observation</button>
        </main>
      )}
    </div>
  );
}

function ObservationList({ items, selected }: { items: ObservationItem[] | null; selected: string | null }) {
  return (
    <section className="obs-list">
      <div className="obs-list-head">
        <h2>Observations</h2>
        <button className="btn btn-small btn-primary only-wide" onClick={() => navigate('/observe')}><Plus size={16} strokeWidth={2.5} aria-hidden="true" />New</button>
      </div>
      {items === null ? (
        <Working>Loading your observations</Working>
      ) : items.length === 0 ? (
        <div className="empty">
          <Sprout size={28} strokeWidth={1.75} aria-hidden="true" />
          <p>No observations yet. Walk your maize and record what you see. Munda works without signal.</p>
        </div>
      ) : (
        <ul>
          {items.map(({ observation: o, synced }) => {
            const top = o.record?.possibleCauses[0];
            return (
              <li key={o.id}>
                <a href={`#/o/${o.id}`} className={`obs-row${selected === o.id ? ' is-selected' : ''}`} aria-current={selected === o.id ? 'page' : undefined}>
                  <span className="obs-row-top">
                    <strong className="obs-plot">{o.plot}</strong>
                    <time className="obs-time" dateTime={new Date(o.createdAtMillis).toISOString()}>{relativeTime(o.createdAtMillis)}</time>
                  </span>
                  <span className="obs-summary">{o.record?.summary ?? o.description}</span>
                  {top && <span className={`obs-top lk-${top.likelihood.toLowerCase()}`}>{Likelihood.label(top.likelihood)}: {top.name}</span>}
                  <span className="badges">
                    {o.record && <UrgencyBadge urgency={o.record.urgency} />}
                    <OriginBadge origin={o.origin} />
                    <SyncBadge synced={synced} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Overview({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="overview">
      <h1>{hasItems ? 'Pick an observation, or record a new one.' : 'Record your first observation.'}</h1>
      <ol className="how">
        <li><strong>Describe what you see.</strong> Type it, add a leaf photo if you have one.</li>
        <li><strong>Answer a few questions.</strong> Munda asks what tells the possible causes apart.</li>
        <li><strong>See possible causes.</strong> With how sure Munda is, and what to check next.</li>
      </ol>
      <p className="muted">When you're back online, Munda compares each record with your plot's history.</p>
      <button className="btn btn-primary" onClick={() => navigate('/observe')}><Plus size={18} strokeWidth={2.5} aria-hidden="true" />New observation</button>
    </div>
  );
}

/** Compact connection + offline-AI status; opens to explain and to start the model download. */
function StatusMenu() {
  const online = useStore(connectivity);
  const local = useStore(mundaAi.local);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (local.state !== 'DOWNLOADING') return;
    const t = setInterval(() => void mundaAi.refreshLocalStatus(), 5000);
    return () => clearInterval(t);
  }, [local.state]);

  const ai =
    local.state === 'AVAILABLE' ? { text: 'Offline AI ready', tone: 'device' }
    : local.state === 'DOWNLOADING' ? { text: `Downloading AI${local.progress != null ? ` ${Math.round(local.progress * 100)}%` : ''}`, tone: 'pending' }
    : local.state === 'DOWNLOADABLE' ? { text: 'Offline AI not downloaded', tone: 'soil' }
    : local.state === 'UNAVAILABLE' ? { text: 'Cloud AI only', tone: 'cloud' }
    : { text: 'Checking AI', tone: 'pending' };

  return (
    <div className="status">
      <button className="status-btn" aria-expanded={open} aria-controls="status-panel" onClick={() => setOpen((v) => !v)}>
        {online ? <Wifi size={16} strokeWidth={2.25} aria-label="Online" /> : <WifiOff size={16} strokeWidth={2.25} aria-label="No signal" />}
        <span className={`status-dot dot-${ai.tone}`} aria-hidden="true" />
        <span>{ai.text}</span>
      </button>
      {open && (
        <div id="status-panel" className="status-panel" role="dialog" aria-label="Connection and AI status">
          <p><strong>{online ? 'You’re online.' : 'No signal.'}</strong> {online ? 'Records sync and get a history review.' : 'Records are saved on this device and sync later.'}</p>
          <p>
            {local.state === 'AVAILABLE' && 'Munda’s questions and field records run on this device, without signal.'}
            {local.state === 'UNAVAILABLE' && 'This device can’t run AI offline. On-device AI needs Chrome on a laptop or desktop. Offline, Munda saves observations and finishes them when you’re back online.'}
            {(local.state === 'DOWNLOADABLE' || local.state === 'DOWNLOADING' || local.state === 'UNKNOWN') && 'Download the offline AI before you go to the field, so Munda works without signal.'}
          </p>
          {local.state === 'DOWNLOADING' && local.progress != null && <progress value={local.progress} max={1} aria-label="Download progress" />}
          {local.state === 'DOWNLOADABLE' && (
            // Chrome requires a click to start the model download.
            <button className="btn btn-secondary" disabled={!online} onClick={() => void mundaAi.ensureLocalModel()}>
              <Download size={16} strokeWidth={2.25} aria-hidden="true" />Download offline AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
