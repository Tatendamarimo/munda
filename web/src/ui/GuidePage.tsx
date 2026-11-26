import { guideReading } from '../domain/reading';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { guideFor, type GuideCategory } from '../domain/guide';
import { localizedEntry } from '../domain/localize';
import { useLang, useT } from '../i18n';
import { GuidePicture, GuideThumb } from './GuidePicture';
import { PageHead } from './Header';
import { ReadAloud } from './ReadAloud';
import { back, href } from './router';

const ORDER: GuideCategory[] = ['PEST', 'DISEASE', 'NUTRIENT', 'WATER', 'WEED'];

export function GuidePage() {
  const t = useT();
  const lang = useLang();
  const [search, setSearch] = useState('');
  const query = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const entries = guideFor('MAIZE').entries.filter((e) => {
    const local = localizedEntry(e, lang);
    return [local.name, local.signs, local.checkInField].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(query);
  });
  return (
    <>
      <PageHead title={t('guide.title')} />
      <div className="page">
        <p className="muted">{t('guide.subtitle')}</p>
        <label className="guide-search"><Search size={21} aria-hidden="true" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('studio.guideSearch')} aria-label={t('studio.guideSearch')} /></label>
        {entries.length === 0 && <p className="hint-card" role="status">{t('studio.guideEmpty')}</p>}
        {ORDER.map((cat) => {
          const list = entries.filter((e) => e.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="guide-category">
              <p className="tag" style={{ marginTop: 8 }}>{t(`guide.categories.${cat}`)}</p>
              <div className="guide-list">{list.map((e) => (
                <a key={e.id} className="plot-row" href={href({ name: 'guideEntry', id: e.id })}>
                  <GuideThumb id={e.id} />
                  <span style={{ flex: 1 }}><b>{localizedEntry(e, lang).name}</b></span>
                  <ChevronRight size={20} className="muted" aria-hidden="true" />
                </a>
              ))}</div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function GuideSection({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <section className="card stack" style={{ gap: 6 }}>
      <h3 className="section-title">{title}</h3>
      <p>{text}</p>
    </section>
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
      <PageHead onBack={back} title={t('guide.title')} right={<ReadAloud prefetch text={guideReading(entry, e, t)} />} />
      <div className="page" style={{ gap: 14 }}>
        <div>
          <p className="tag">{t(`guide.categories.${entry.category}`)}</p>
          <h2 className="page-title">{e.name}</h2>
        </div>
        <GuidePicture id={entry.id} alt={e.name} />
        <section className="card stack" style={{ gap: 6 }}>
          <h3 className="section-title">{t('guide.signs')}</h3>
          <p>{e.signs}</p>
        </section>
        {entry.report && <p className="report-now" role="alert">{t('guide.report')}</p>}
        <aside className="check-first">
          <p className="check-first-title">{t('guide.check')}</p>
          <p>{e.checkInField}</p>
        </aside>
        {/* The richer sections are English until translated; they fall back like everything else. */}
        <GuideSection title={t('guide.distinguish')} text={entry.distinguish} />
        <GuideSection title={t('guide.byStage')} text={entry.byStage} />
        <GuideSection title={t('guide.likelyWhen')} text={entry.likelyWhen} />
        <GuideSection title={t('guide.actNow')} text={entry.actNow} />
        <GuideSection title={t('guide.prevent')} text={entry.prevent} />
        {entry.sources && entry.sources.length > 0 && (
          <section className="stack guide-sources" style={{ gap: 6 }}>
            <p className="tag">{t('guide.sources')}</p>
            <ul>{entry.sources.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a></li>)}</ul>
            <p className="muted small">{t('guide.unchecked')}</p>
          </section>
        )}
      </div>
    </>
  );
}
