import { connectivity } from '../data/connectivity';
import { session, type SessionState } from '../data/session';
import { useStore } from '../data/store';
import { LANG_CODES, LANGS, setLanguage, useLang, useT } from '../i18n';
import { CauseCard } from './CauseCard';
import { OriginBadge, Working } from './components';
import { Hero } from './Header';

/**
 * First run. Language comes first (it's the farmer's first choice), then the promise, then the
 * product's own output as proof: a real possible-cause entry, honest about uncertainty.
 */
export function Welcome({ state }: { state: SessionState }) {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  return (
    <div className="welcome">
      <Hero>
        <div className="lang-chips" role="group" aria-label="Language">
          {LANG_CODES.map((l) => (
            <button key={l} className="lang-chip" aria-pressed={l === lang} onClick={() => setLanguage(l)}>
              {LANGS[l].native}{LANGS[l].beta ? ' β' : ''}
            </button>
          ))}
        </div>
      </Hero>
      <main className="welcome-main">
        <section className="welcome-copy">
          <h1>{t('welcome.title')}</h1>
          <p className="lede">{t('welcome.lede')}</p>
          {(state.kind === 'loading' || state.kind === 'activating') && <Working>{t('welcome.settingUp')}</Working>}
          {state.kind === 'error' && <p className="error" role="alert">{state.message}</p>}
          <button className="btn btn-primary btn-main" disabled={!online || state.kind === 'activating' || state.kind === 'loading'} onClick={() => void session.activate()}>
            {online ? t('welcome.setup') : t('welcome.setupOffline')}
          </button>
          <p className="fineprint">{t('welcome.fineprint')}</p>
        </section>
        <section className="welcome-sample" aria-label="Example">
          <div className="sample-head">
            <p>{t('welcome.sample')}</p>
            <OriginBadge origin="ON_DEVICE" />
          </div>
          <CauseCard
            lead
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
