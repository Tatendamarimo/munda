import { Users } from 'lucide-react';
import { useState } from 'react';
import { connectivity } from '../data/connectivity';
import { createGroup, group, joinGroup, leaveGroup } from '../data/group';
import { prefs } from '../data/prefs';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { useT } from '../i18n';
import { href } from './router';

/** Join a cooperative with its code, or (for an extension officer) start one and share the code. */
export function GroupCard() {
  const t = useT();
  const g = useStore(group);
  const s = useStore(session);
  const online = useStore(connectivity);
  const me = useStore(prefs).name;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const uid = s.kind === 'ready' ? s.uid : null;
  if (!uid) return null;

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true); setProblem(null);
    try { await fn(); } catch { setProblem(t('group.notFound')); } finally { setBusy(false); }
  };

  return (
    <section className="card stack">
      <h2 className="section-title"><Users size={20} strokeWidth={2.25} aria-hidden="true" />{t('group.title')}</h2>
      {g ? (
        <>
          <p>{t(g.role === 'officer' ? 'group.officer' : 'group.member', { name: g.name })}</p>
          {g.role === 'officer' && <p className="group-code">{t('group.code', { code: g.orgId.slice(2) })}</p>}
          {g.role === 'officer' && <a className="btn btn-primary" href={href({ name: 'area' })}>{t('group.openView')}</a>}
          <button className="btn btn-ghost" disabled={busy} onClick={run(() => leaveGroup(uid))}>{t('group.leave')}</button>
        </>
      ) : (
        <>
          <p className="muted small">{t('group.help')}</p>
          <div className="group-join">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('group.codePlaceholder')} aria-label={t('group.codePlaceholder')} autoCapitalize="characters" maxLength={9} />
            <button className="btn btn-primary" disabled={busy || !online || code.trim().length < 6} onClick={run(() => joinGroup(uid, code, me))}>{t('group.join')}</button>
          </div>
          {!online && <p className="muted small">{t('group.needsSignal')}</p>}
          {problem && <p className="hint error">{problem}</p>}
          <details className="details">
            <summary>{t('group.startTitle')}</summary>
            <div className="stack">
              <p className="muted small">{t('group.startHelp')}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('group.namePlaceholder')} aria-label={t('group.namePlaceholder')} maxLength={60} />
              <button className="btn btn-ghost" disabled={busy || !online || name.trim() === ''} onClick={run(() => createGroup(uid, name, me))}>{t('group.start')}</button>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
