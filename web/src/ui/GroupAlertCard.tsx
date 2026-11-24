import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { group } from '../data/group';
import { observeAlerts, type GroupAlert } from '../data/groupData';
import { useStore } from '../data/store';
import { relativeTime, useLang, useT } from '../i18n';
import { alertText } from './alertText';

const SHOW_FOR = 14 * 86_400_000;

/** The latest alert the group's officer confirmed: area and count only, never a farm. */
export function GroupAlertCard() {
  const t = useT();
  const lang = useLang();
  const g = useStore(group);
  const [alerts, setAlerts] = useState<GroupAlert[]>([]);
  useEffect(() => (g ? observeAlerts(g.orgId, setAlerts) : undefined), [g]);
  const now = Date.now();
  const a = alerts.find((x) => now - x.createdAt < SHOW_FOR);
  if (!a) return null;
  return (
    <div className="group-alert" role="status">
      <BellRing size={22} strokeWidth={2.25} aria-hidden="true" />
      <span><b>{t('home.groupAlert')} · {relativeTime(a.createdAt, now, lang)}</b><br />{alertText(t, lang, a)}</span>
    </div>
  );
}
