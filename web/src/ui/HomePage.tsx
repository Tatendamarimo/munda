import { useT } from '../i18n';
import { Hero } from './Header';
import { StatusPill } from './StatusPill';

export function HomePage() {
  const t = useT();
  return <Hero right={<StatusPill />}><h1>{t('home.greetingNoName')}</h1></Hero>;
}
