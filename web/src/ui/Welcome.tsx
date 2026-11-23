import { connectivity } from '../data/connectivity';
import { session, type SessionState } from '../data/session';
import { useStore } from '../data/store';
import { Wordmark } from './brand';
import { CauseEntry, OriginBadge, Working } from './components';

/**
 * First run. The hero is the product's own output, a real possible-cause entry, because that's
 * the thing that makes Munda different: careful, honest about uncertainty, and actionable.
 */
export function Welcome({ state }: { state: SessionState }) {
  const online = useStore(connectivity);
  return (
    <div className="welcome">
      <header className="appbar"><Wordmark /></header>
      <main className="welcome-main">
        <section className="welcome-copy">
          <h1>Know what to check next in your maize field.</h1>
          <p className="lede">
            Describe what you see. Munda asks a few questions, then shows the possible causes, how sure it is about each, and what to check before you spend money. It works without signal.
          </p>
          {(state.kind === 'loading' || state.kind === 'activating') && <Working>Setting up this device</Working>}
          {state.kind === 'error' && <p className="error" role="alert">{state.message}</p>}
          <button className="btn btn-primary btn-large" disabled={!online || state.kind === 'activating' || state.kind === 'loading'} onClick={() => void session.activate()}>
            {online ? 'Set up this device' : 'Connect to the internet to set up'}
          </button>
          <p className="fineprint">Setup needs signal once. After that, Munda works offline. Photos never leave your device.</p>
        </section>
        <section className="welcome-sample" aria-label="Example of a Munda field record">
          <div className="sample-head">
            <p>Lower leaves yellowing from the tip after heavy rain.</p>
            <OriginBadge origin="ON_DEVICE" />
          </div>
          <CauseEntry
            animate
            cause={{
              guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'HIGH',
              supporting: ['Lower leaves yellow first', 'Yellowing runs from the tip down the middle'],
              againstOrMissing: ['No record of fertilizer this season'],
              checkNext: 'Compare with a row that was top-dressed.',
            }}
          />
        </section>
      </main>
    </div>
  );
}
