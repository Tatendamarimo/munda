import { ChevronLeft, Globe2, MapPin, ScanLine, Sprout, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { mundaAi } from '../ai/mundaAi';
import { onboarding, finishSetup, setSetupStep, SETUP_STEPS, type SetupStep } from '../data/onboarding';
import { prefs, updatePrefs } from '../data/prefs';
import { session, type SessionState } from '../data/session';
import { useStore } from '../data/store';
import { LANG_CODES, LANGS, setLanguage, useLang, useT } from '../i18n';
import { AccountOptions } from './AccountCard';
import { Wordmark } from './brand';
import { FieldArtwork } from './FieldArtwork';
import { StatusDetails } from './StatusPill';
import { Working } from './components';

const HELP = { language: 'setup.languageHelp', account: 'setup.accountHelp', name: 'setup.nameHelp', area: 'setup.areaHelp', readiness: 'setup.readinessHelp' } as const;
const ICONS = { language: Globe2, account: Sprout, name: UserRound, area: MapPin, readiness: ScanLine };
export function Onboarding({ state }: { state: SessionState }) {
  const t = useT(); const lang = useLang(); const setup = useStore(onboarding); const p = useStore(prefs);
  const local = useStore(mundaAi.local);
  const [problem, setProblem] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const canPersonalize = state.kind === 'ready';
  // A signed-out device resumes at language/account, not past the identity requirement.
  const step: SetupStep = !canPersonalize && SETUP_STEPS.indexOf(setup.step) > 1 ? 'account' : setup.step;
  const index = SETUP_STEPS.indexOf(step);
  const Icon = ICONS[step];
  const move = (next: SetupStep) => { setProblem(''); setSetupStep(next); window.scrollTo({top:0}); };
  useEffect(() => { heading.current?.focus({preventScroll:true}); }, [step]);
  const complete = () => { const s = session.ready; if (s) { finishSetup(s.uid); window.location.hash = '/'; } };
  return <div className="setup-shell">
    <header className="setup-nav"><span className="welcome-brand"><Wordmark /></span><span>{t('setup.step', {n:index+1,total:SETUP_STEPS.length})}</span></header>
    <main className="setup-layout" id="main-content">
      <section className="setup-panel">
        <div className="setup-progress" aria-label={t('setup.step',{n:index+1,total:SETUP_STEPS.length})}>{SETUP_STEPS.map((s,i) => <span key={s} className={i<=index ? 'is-done' : ''} />)}</div>
        <div className="setup-step-heading"><span className="empty-icon"><Icon size={25} aria-hidden="true" /></span><span className="eyebrow">{t('studio.companion')}</span></div>
        <h1 ref={heading} tabIndex={-1}>{t(`setup.${step}`)}</h1>
        <p className="setup-description">{t(HELP[step])}</p>
        {state.kind === 'loading' ? <Working>{t('common.loading')}</Working> : <>
          {step === 'language' && <><div className="setup-languages" role="group" aria-label={t('me.language')}>{LANG_CODES.map((l) => <button key={l} type="button" aria-pressed={l===lang} className="setup-language" onClick={() => setLanguage(l)}><b>{LANGS[l].native}</b>{LANGS[l].beta && <small>{t('common.beta')}</small>}</button>)}</div><button className="btn btn-primary btn-main" onClick={() => move('account')}>{t('setup.next')}</button></>}
          {step === 'account' && <AccountOptions allowGuest onComplete={() => move('name')} />}
          {step === 'name' && <form className="setup-form" onSubmit={(e) => {e.preventDefault();updatePrefs({name:p.name.trim()});move('area');}}><label className="field"><span className="field-label">{t('me.name')}</span><input autoComplete="given-name" value={p.name} maxLength={40} placeholder={t('setup.namePlaceholder')} onChange={(e) => updatePrefs({name:e.target.value})} /></label><button className="btn btn-primary btn-main">{t('setup.next')}</button><button type="button" className="text-btn" onClick={() => { updatePrefs({name:p.name.trim()}); move('area'); }}>{t('setup.skip')}</button></form>}
          {step === 'area' && <form className="setup-form" onSubmit={(e) => {e.preventDefault();updatePrefs({place:p.place.trim()});move('readiness');}}><label className="field"><span className="field-label">{t('me.place')}</span><input autoComplete="address-level2" value={p.place} maxLength={40} placeholder={t('setup.areaPlaceholder')} onChange={(e) => updatePrefs({place:e.target.value})} /></label><p className="privacy-note hint">{t('setup.location')}</p><button className="btn btn-primary btn-main">{t('setup.next')}</button><button type="button" className="text-btn" onClick={() => { updatePrefs({place:p.place.trim()}); move('readiness'); }}>{t('setup.skip')}</button></form>}
          {step === 'readiness' && <><section className="setup-readiness"><StatusDetails /></section><p className="hint">{t('setup.readyGuide')}</p>{(local.state === 'DOWNLOADABLE' || local.state === 'DOWNLOADING') && <p className="hint">{t('setup.downloadHelp')}</p>}<button className="btn btn-primary btn-main" onClick={complete}>{t('setup.enter')}</button></>}
          {problem && <p role="alert" className="account-error">{problem}</p>}
          {index>0 && <button type="button" className="setup-back" onClick={() => move(SETUP_STEPS[index-1]!)}><ChevronLeft size={18} aria-hidden="true" />{t('setup.back')}</button>}
        </>}
        <p className="setup-footnote">{t('setup.saved')}</p>
      </section>
      <aside className="setup-art"><FieldArtwork /><div className="setup-art-caption"><span className="eyebrow">{t('setup.title')}</span><p>{t('studio.localFirst')}</p></div></aside>
    </main>
  </div>;
}
