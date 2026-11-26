import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { pickDeviceArea } from '../data/deviceArea';
import { useT } from '../i18n';
export function LocationButton() {
  const t = useT(); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<'denied'|'failed'|'selected'|null>(null);
  return <div className="stack" style={{gap:8}}>
    <p className="hint">{t('location.help')}</p>
    <button type="button" className="btn btn-ghost" disabled={busy} aria-busy={busy} onClick={async () => {
      setBusy(true); setNotice(null);
      try { await pickDeviceArea(); setNotice('selected'); }
      catch(e) { setNotice((e as {code?:number}).code === 1 ? 'denied' : 'failed'); }
      finally { setBusy(false); }
    }}><MapPin size={18} aria-hidden="true" />{t(busy ? 'location.finding' : 'location.use')}</button>
    {notice && <p role="status" className="hint">{t(`location.${notice}`)}</p>}
  </div>;
}
