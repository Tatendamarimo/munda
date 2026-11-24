import { Wordmark } from './brand';
import { Leaf, ScanLine, ShieldCheck, Smartphone, Sprout } from 'lucide-react';
import { useState } from 'react';
import { connectivity } from '../data/connectivity';
import { session, type SessionState } from '../data/session';
import { useStore } from '../data/store';
import { LANG_CODES, LANGS, setLanguage, useLang, useT } from '../i18n';
import { CauseCard } from './CauseCard';
import { Working } from './components';
import { FieldArtwork } from './FieldArtwork';
import { StatusPill } from './StatusPill';

const ANDROID_APK = 'https://github.com/Tatendamarimo/munda/releases/latest/download/munda.apk';

export function Welcome({ state }: { state: SessionState }) {
  const t = useT();
  const lang = useLang();
  const online = useStore(connectivity);
  const [example, setExample] = useState(false);
  return (
    <div className="welcome welcome-refined">
      <header className="welcome-nav">
        <a className="welcome-brand" href="#/" aria-label="Munda"><Wordmark /></a>
        <StatusPill light />
      </header>
      <main id="main-content" className="welcome-main">
        <section className="welcome-copy">
          <span className="eyebrow"><Sprout size={17} aria-hidden="true" />{t('studio.companion')}</span>
          <h1>{t('welcome.title')}</h1>
          <p className="lede">{t('welcome.lede')}</p>
          <div className="welcome-actions">
            {(state.kind === 'loading' || state.kind === 'activating') && <Working>{t('welcome.settingUp')}</Working>}
            {state.kind === 'error' && <p className="error" role="alert">{state.message}</p>}
            <button className="btn btn-primary btn-main" disabled={!online || state.kind === 'activating' || state.kind === 'loading'} onClick={() => void session.activate()}>{online ? t('welcome.setup') : t('welcome.setupOffline')}</button>
            <button className="btn btn-example" aria-expanded={example} aria-controls="welcome-example" onClick={() => setExample(!example)}>{example ? t('studio.hideExample') : t('studio.seeExample')}</button>
          </div>
          <p className="fineprint">{t('welcome.fineprint')}</p>
          {/* Android is the main farmer app; the file is attached to each GitHub release. */}
          <a className="android-link" href={ANDROID_APK} rel="noopener">
            <Smartphone size={18} aria-hidden="true" /><span><b>{t('studio.getAndroid')}</b><small>{t('studio.getAndroidHelp')}</small></span>
          </a>
          <div className="welcome-languages">
            <span className="tag">{t('me.language')}</span>
            <div className="lang-chips" role="group" aria-label={t('me.language')}>
              {LANG_CODES.map((l) => <button key={l} className="lang-chip" aria-pressed={l === lang} onClick={() => setLanguage(l)}>{LANGS[l].native}{LANGS[l].beta ? ' β' : ''}</button>)}
            </div>
          </div>
        </section>
        <section className="welcome-visual" aria-label={t('studio.companion')}>
          <FieldArtwork />
          <div className="field-caption"><span className="field-caption-icon"><ScanLine size={22} /></span><div><b>{t('studio.localFirst')}</b><p>{t('studio.act')}</p></div><Leaf size={22} aria-hidden="true" /></div>
          <div className="welcome-principles"><span><ScanLine size={17} />{t('studio.observe')}</span><span><ShieldCheck size={17} />{t('studio.act')}</span></div>
        </section>
        {example && <section id="welcome-example" className="welcome-example" aria-label={t('studio.example')}>
          <div className="stack"><span className="eyebrow">{t('studio.example')}</span><h2>{t('studio.sampleTitle')}</h2><p className="muted">{t('studio.sampleHelp')}</p><p className="sample-observation">{t('welcome.sample')}</p></div>
          <CauseCard lead cause={{ guideId: 'nitrogen', name: 'Nitrogen deficiency', likelihood: 'HIGH', supporting: ['Lower leaves yellow first', 'Yellowing runs from the tip down the middle'], againstOrMissing: ['No record of fertilizer this season'], checkNext: 'Compare with a row that was top-dressed.' }} />
        </section>}
      </main>
    </div>
  );
}
