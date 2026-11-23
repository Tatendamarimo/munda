import { ChevronRight } from 'lucide-react';
import { guideFor, type GuideCategory } from '../domain/guide';
import { localizedEntry } from '../domain/localize';
import { useLang, useT } from '../i18n';
import { PageHead } from './Header';
import { ReadAloud } from './ReadAloud';
import { back, href } from './router';

const ORDER: GuideCategory[] = ['PEST', 'DISEASE', 'NUTRIENT', 'WATER', 'WEED'];

export function GuidePage() {
  const t = useT();
  const lang = useLang();
  const entries = guideFor('MAIZE').entries;
  return (
    <>
      <PageHead title={t('guide.title')} />
      <div className="page">
        <p className="muted">{t('guide.subtitle')}</p>
        {ORDER.map((cat) => {
          const list = entries.filter((e) => e.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="stack" style={{ gap: 8 }}>
              <p className="tag" style={{ marginTop: 8 }}>{t(`guide.categories.${cat}`)}</p>
              {list.map((e) => (
                <a key={e.id} className="plot-row" href={href({ name: 'guideEntry', id: e.id })}>
                  <span style={{ flex: 1 }}><b>{localizedEntry(e, lang).name}</b></span>
                  <ChevronRight size={20} className="muted" aria-hidden="true" />
                </a>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

export function GuideEntryPage({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const entry = guideFor('MAIZE').get(id);
  if (!entry) return <><PageHead onBack={back} /><div className="page"><p>{t('record.notAvailable')}</p></div></>;
  const e = localizedEntry(entry, lang);
  return (
    <>
      <PageHead onBack={back} title={t('guide.title')} right={<ReadAloud text={[e.name, t('guide.signs'), e.signs, t('guide.check'), e.checkInField].join('. ')} />} />
      <div className="page" style={{ gap: 14 }}>
        <div>
          <p className="tag">{t(`guide.categories.${entry.category}`)}</p>
          <h2 className="page-title">{e.name}</h2>
        </div>
        <section className="card stack" style={{ gap: 6 }}>
          <h3 className="section-title">{t('guide.signs')}</h3>
          <p>{e.signs}</p>
        </section>
        <aside className="check-first">
          <p className="check-first-title">{t('guide.check')}</p>
          <p>{e.checkInField}</p>
        </aside>
      </div>
    </>
  );
}
