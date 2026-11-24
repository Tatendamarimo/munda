import { Wordmark } from './brand';
import { BookOpen, House, Sprout, UserRound } from 'lucide-react';
import { useT } from '../i18n';
import { href, type Tab } from './router';

const TABS: Array<{ tab: Tab; icon: typeof House }> = [
  { tab: 'home', icon: House },
  { tab: 'plots', icon: Sprout },
  { tab: 'guide', icon: BookOpen },
  { tab: 'me', icon: UserRound },
];

export function TabBar({ active }: { active: Tab | null }) {
  const t = useT();
  return (
    <nav className="tabbar" aria-label="Munda">
      <a className="rail-brand" href={href({ name: 'home' })} aria-label="Munda"><Wordmark /></a>
      {TABS.map(({ tab, icon: Icon }) => (
        <a key={tab} className="tab" href={href({ name: tab })} aria-current={active === tab ? 'page' : undefined}>
          <Icon size={23} strokeWidth={active === tab ? 2.4 : 2} aria-hidden="true" />
          {t(`tabs.${tab}`)}
        </a>
      ))}
      <div className="rail-footer"><Sprout size={20} aria-hidden="true" /><span>{t('studio.companion')}</span></div>
    </nav>
  );
}
