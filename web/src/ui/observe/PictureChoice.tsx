import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';

/**
 * One question as large picture tiles (two columns). "Not sure" is a quiet text button, not a
 * tile, so it's always available but never the easy default.
 */
export function PictureChoice<T extends string>({ question, options, selected, picture, label, onSelect }: {
  question: string;
  options: readonly T[];
  selected: T | undefined;
  picture: (t: T) => ReactNode;
  label: (t: T) => string;
  onSelect: (t: T) => void;
}) {
  const t = useT();
  const tiles = options.filter((o) => o !== 'UNKNOWN');
  const hasUnknown = options.includes('UNKNOWN' as T);
  return (
    <div className="stack">
      <div className="tiles" role="radiogroup" aria-label={question}>
        {tiles.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === selected} className="tile" onClick={() => onSelect(o)}>
            <span className="tile-pic">{picture(o)}</span>
            <b>{label(o)}</b>
            {o === selected && <Check className="tile-check" size={18} strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {hasUnknown && (
        <button type="button" className="text-btn" aria-pressed={selected === 'UNKNOWN'} onClick={() => onSelect('UNKNOWN' as T)}>
          {t('common.notSure')}
        </button>
      )}
    </div>
  );
}
