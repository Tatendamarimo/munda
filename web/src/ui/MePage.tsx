import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { prefs, updatePrefs } from '../data/prefs';
import { useStore } from '../data/store';
import { connectivity } from '../data/connectivity';
import { freshWeather, placeNotFound, setWeatherEnabled, weather, weatherEnabled } from '../data/weather';
import { LANG_CODES, LANGS, setLanguage, useLang, useT } from '../i18n';
import { PageHead } from './Header';
import { GroupCard } from './GroupCard';
import { StatusDetails } from './StatusPill';

/** A text field that saves when the farmer leaves it, so typing never fights re-renders. */
function SavedInput({ value, onSave, ...rest }: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input {...rest} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} />;
}

export function MePage() {
  const t = useT();
  const lang = useLang();
  const p = useStore(prefs);
  const weatherOn = useStore(weatherEnabled);
  const online = useStore(connectivity);
  const notFound = useStore(placeNotFound);
  const w = freshWeather(useStore(weather), Date.now());
  return (
    <>
      <PageHead title={t('me.title')} />
      <div className="page" style={{ gap: 14 }}>
        <section className="card stack">
          <h2 className="section-title">{t('me.language')}</h2>
          <div className="lang-chips" role="group" aria-label={t('me.language')}>
            {LANG_CODES.map((l) => (
              <button key={l} className="lang-chip" aria-pressed={l === lang} onClick={() => setLanguage(l)}>
                {LANGS[l].native}{LANGS[l].beta ? ` · ${t('common.beta')}` : ''}
              </button>
            ))}
          </div>
          {LANGS[lang].beta && <p className="muted small">{t('me.betaNote')}</p>}
        </section>

        <section className="card stack">
          <label className="field"><span className="field-label">{t('me.name')}</span>
            <SavedInput value={p.name} placeholder={t('me.namePlaceholder')} maxLength={40} autoComplete="given-name" onSave={(name) => updatePrefs({ name })} />
          </label>
          <label className="field"><span className="field-label">{t('me.place')}</span>
            <SavedInput value={p.place} placeholder={t('me.placePlaceholder')} maxLength={40} onSave={(place) => updatePrefs({ place })} />
          </label>
        </section>

        <section className="card stack">
          <h2 className="section-title">{t('me.weather')}</h2>
          <p className="muted small">{t('me.weatherHelp')}</p>
          <button className={`btn ${weatherOn ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setWeatherEnabled(!weatherOn)}>
            <MapPin size={18} strokeWidth={2.25} aria-hidden="true" />{weatherOn ? t('me.weatherOff') : t('me.weatherOn')}
          </button>
          {weatherOn && w && <p className="small">{w.where ? `${t('me.weatherFor', { place: w.where })} · ` : ''}{t('home.temp', { temp: w.tempC })}</p>}
          {weatherOn && notFound && <p className="hint error">{t('me.placeNotFound', { place: notFound })}</p>}
          {weatherOn && !w && !notFound && online && <p className="hint">{t('me.weatherNone')}</p>}
        </section>

        <GroupCard />

        <section className="card stack">
          <h2 className="section-title">{t('me.extension')}</h2>
          <p className="muted small">{t('me.extensionHelp')}</p>
          <label className="field"><span className="field-label">{t('me.extName')}</span>
            <SavedInput value={p.extension?.name ?? ''} maxLength={60} onSave={(name) => updatePrefs({ extension: name || p.extension?.phone ? { name, phone: p.extension?.phone ?? '' } : null })} />
          </label>
          <label className="field"><span className="field-label">{t('me.extPhone')}</span>
            <SavedInput value={p.extension?.phone ?? ''} type="tel" inputMode="tel" maxLength={24} autoComplete="off" onSave={(phone) => updatePrefs({ extension: phone || p.extension?.name ? { name: p.extension?.name ?? '', phone } : null })} />
          </label>
        </section>

        <section className="card stack">
          <h2 className="section-title">{t('me.offlineAi')}</h2>
          <StatusDetails />
        </section>

        <p className="muted small" style={{ padding: '0 4px' }}>{t('me.about')}</p>
      </div>
    </>
  );
}
