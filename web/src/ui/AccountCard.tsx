import { Eye, EyeOff, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { account, authIssue, session } from '../data/session';
import { connectivity } from '../data/connectivity';
import { useStore } from '../data/store';
import { useT } from '../i18n';

/** Shared account controls. Passwords exist only in component state and are never persisted. */
export function AccountOptions({ allowGuest = false, onComplete }: { allowGuest?: boolean; onComplete?: () => void }) {
  const t = useT();
  const a = useStore(account);
  const online = useStore(connectivity);
  const [mode, setMode] = useState<'choice' | 'create' | 'signIn' | 'reset'>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const change = (next: typeof mode) => { setMode(next); setPassword(''); setConfirm(''); setError(''); setNotice(''); };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); }
    catch (e) { setError(t(`auth.${authIssue(e)}`)); }
    finally { setBusy(false); }
  };
  const guest = () => run(async () => {
    if (a.kind === 'guest' || await session.activate()) onComplete?.();
    else setError(t('auth.network'));
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create' && password !== confirm) { setError(t('auth.mismatch')); return; }
    void run(async () => {
      if (mode === 'reset') {
        try { await session.resetPassword(email); } catch (e) {
          if ((e as {code?: string}).code !== 'auth/user-not-found') throw e;
        }
        setNotice(t('auth.resetSent')); return;
      }
      if (mode === 'signIn') await session.signInEmail(email, password);
      else await session.createEmail(email, password);
      setPassword(''); setConfirm(''); setMode('choice');
      setNotice(t('auth.protectDone')); onComplete?.();
    });
  };
  if (a.kind === 'member') return <div className="account-options">
    <div className="account-identity"><span className="empty-icon"><ShieldCheck size={25} aria-hidden="true" /></span><div><b>{t('auth.member')}</b><p>{a.email}</p></div></div>
    <p className="hint">{t('auth.createHelp')}</p>
    <span className={`badge ${a.verified ? 'badge-ok' : 'badge-pending'}`}>{t(a.verified ? 'auth.verified' : 'auth.verificationNeeded')}</span>
    {!a.verified && <div className="stack"><button type="button" className="btn btn-secondary" disabled={busy || !online} onClick={() => void run(async () => { await session.verifyEmail(); setNotice(t('auth.verifySent')); })}><Mail size={18} aria-hidden="true" />{t('auth.verify')}</button><button type="button" className="text-btn" disabled={busy || !online} onClick={() => void run(() => session.refreshAccount())}>{t('auth.refresh')}</button></div>}
    {notice && <p className="account-notice" role="status">{notice}</p>}{error && <p className="account-error" role="alert">{error}</p>}
    {onComplete && <button className="btn btn-primary btn-main" onClick={onComplete}>{t('common.continue')}</button>}
  </div>;
  return <div className="account-options">
    {mode === 'choice' ? <>
      {a.kind === 'guest' && <div className="account-identity"><span className="empty-icon"><UserRound size={24} aria-hidden="true" /></span><b>{t('auth.guest')}</b></div>}
      {allowGuest && <div className="account-choice"><button className="btn btn-primary btn-main" disabled={busy || (!online && a.kind !== 'guest')} onClick={() => void guest()}>{busy ? t('welcome.settingUp') : t('setup.guest')}</button><p>{t('setup.guestHelp')}</p></div>}
      {!allowGuest && <p className="muted">{t('auth.protectHelp')}</p>}
      <button type="button" className="btn btn-secondary btn-main" disabled={busy || !online} onClick={() => change('create')}><ShieldCheck size={19} aria-hidden="true" />{t(a.kind === 'guest' ? 'auth.protect' : 'auth.create')}</button>
      {a.kind !== 'guest' && <button type="button" className="btn btn-example" disabled={busy || !online} onClick={() => change('signIn')}>{t('auth.signIn')}</button>}
    </> : <form className="account-form" onSubmit={submit}>
      <h3>{t(mode === 'create' ? a.kind === 'guest' ? 'auth.protect' : 'auth.create' : mode === 'signIn' ? 'auth.signIn' : 'auth.forgot')}</h3>
      <p className="hint">{t(mode === 'create' ? a.kind === 'guest' ? 'auth.protectHelp' : 'auth.createHelp' : 'auth.signInHelp')}</p>
      <label className="field"><span className="field-label">{t('auth.email')}</span><input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required disabled={busy} /></label>
      {mode !== 'reset' && <>
        <label className="field"><span className="field-label">{t('auth.password')}</span><div className="password-input"><input type={visible ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={mode === 'create' ? 8 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} /><button type="button" className="password-toggle" aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></label>
        {mode === 'create' && <><p className="hint">{t('auth.passwordHelp')}</p><label className="field"><span className="field-label">{t('auth.confirm')}</span><input type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} required disabled={busy} /></label></>}
      </>}
      <button className="btn btn-primary btn-main" type="submit" disabled={busy || !online}>{busy ? t('common.loading') : t(mode === 'reset' ? 'auth.reset' : mode === 'signIn' ? 'auth.signIn' : a.kind === 'guest' ? 'auth.protect' : 'auth.create')}</button>
      {mode === 'signIn' && <button type="button" className="text-btn" disabled={busy} onClick={() => change('reset')}>{t('auth.forgot')}</button>}
      <button type="button" className="btn btn-example" disabled={busy} onClick={() => change('choice')}>{t('auth.cancel')}</button>
    </form>}
    {!online && <p className="hint">{t('auth.needSignal')}</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}{error && <p className="account-error" role="alert">{error}</p>}
  </div>;
}
export function AccountCard() {
  const t = useT();
  return <section className="card stack" id="account-settings"><h2 className="section-title"><ShieldCheck size={21} aria-hidden="true" />{t('auth.title')}</h2><AccountOptions /></section>;
}
