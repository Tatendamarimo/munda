import { BellRing, CheckCircle2, Radio, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { group } from '../data/group';
import { confirmAlert, memberCount, observeAlerts, type GroupAlert } from '../data/groupData';
import { repository, type ObservationItem } from '../data/repository';
import { session } from '../data/session';
import { useStore } from '../data/store';
import { guideFor } from '../domain/guide';
import { areaSummary, type AreaProblem } from '../domain/groups';
import { localizedEntry } from '../domain/localize';
import { relativeTime, useLang, useT } from '../i18n';
import { AreaMap, type MapCell } from './AreaMap';
import { Working } from './components';
import { PageHead } from './Header';
import { back } from './router';

/**
 * The extension officer's view: the group's checks this week by area, live. Counts per problem
 * and area, a map of ~5 km squares (never a farm), and a Confirm that alerts the whole group.
 */
export function AreaPage() {
  const t = useT();
  const lang = useLang();
  const g = useStore(group);
  const s = useStore(session);
  const [items, setItems] = useState<ObservationItem[] | null>(null);
  const [alerts, setAlerts] = useState<GroupAlert[]>([]);
  const [members, setMembers] = useState<number | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const orgId = g?.orgId ?? null;

  useEffect(() => (orgId ? repository.observeRecent(orgId, setItems, 300) : undefined), [orgId]);
  useEffect(() => (orgId ? observeAlerts(orgId, setAlerts) : undefined), [orgId]);
  useEffect(() => { if (orgId) void memberCount(orgId).then(setMembers); }, [orgId, items?.length]);

  const now = Date.now();
  const summary = useMemo(() => areaSummary((items ?? []).map((i) => i.observation), now), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const guide = guideFor('MAIZE');
  const nameOf = (p: string) => { const e = guide.get(p); return e ? localizedEntry(e, lang).name : p; };
  const farms = (n: number) => (n === 1 ? t('area.farmsOne') : t('area.farms', { n }));
  const cells: MapCell[] = useMemo(() => {
    const byCell = new Map<string, AreaProblem[]>();
    for (const a of summary) for (const c of a.cells) byCell.set(c, [...(byCell.get(c) ?? []), a]);
    return [...byCell.entries()].map(([cell, list]) => ({
      cell, farms: Math.max(...list.map((x) => x.farms)),
      label: list.map((x) => `${nameOf(x.problem)}: ${farms(x.farms)}`).join(' · '),
    }));
  }, [summary, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || g.role !== 'officer' || s.kind !== 'ready') {
    return <><PageHead onBack={back} title={t('area.title')} /><div className="page"><p className="muted">{t('group.help')}</p></div></>;
  }
  const sentThisWeek = (a: AreaProblem) => alerts.some((x) => x.problem === a.problem && (x.area ?? '') === a.area && now - x.createdAt < 7 * 86_400_000);
  const confirm = async (a: AreaProblem) => {
    const key = `${a.problem}|${a.area}`;
    setSending(key);
    try {
      await confirmAlert(g.orgId, s.uid, { problem: a.problem, area: a.area || null, count: a.farms,
        message: t('area.alertMessage', { problem: nameOf(a.problem), n: a.farms, area: a.area || t('area.noArea') }) });
    } finally { setSending(null); }
  };

  return (
    <>
      <PageHead onBack={back} title={g.name} />
      <div className="page" style={{ gap: 14 }}>
        <div className="area-head">
          <span className="live-dot"><Radio size={14} strokeWidth={2.5} aria-hidden="true" />{t('area.live')}</span>
          {members !== null && <span className="muted small">{t('area.members', { n: members })}</span>}
        </div>
        <p className="muted">{t('area.lede')}</p>
        <AreaMap cells={cells} />
        {items === null ? <Working>{t('common.loading')}</Working>
          : summary.length === 0 ? <p className="hint-card">{t('area.empty')}</p>
          : summary.map((a) => {
            const key = `${a.problem}|${a.area}`;
            const sent = sentThisWeek(a);
            return (
              <article key={key} className={`area-row${a.farms >= 3 ? ' is-hot' : ''}`}>
                <div className="area-row-main">
                  <b>{nameOf(a.problem)}</b>
                  <span className="muted small">{a.area || t('area.noArea')} · {farms(a.farms)} · {t('area.checks', { n: a.checks })} · {relativeTime(a.lastAt, now, lang)}</span>
                  {a.worsening > 0 && <span className="area-worse"><TrendingUp size={14} strokeWidth={2.5} aria-hidden="true" />{t('area.worsening', { n: a.worsening })}</span>}
                </div>
                {sent ? <span className="area-sent"><CheckCircle2 size={16} strokeWidth={2.5} aria-hidden="true" />{t('area.confirmed')}</span>
                  : <button className="btn btn-primary" disabled={sending === key} onClick={() => void confirm(a)}><BellRing size={16} strokeWidth={2.25} aria-hidden="true" />{t('area.confirm')}</button>}
              </article>
            );
          })}
      </div>
    </>
  );
}
