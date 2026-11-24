import { guideImage } from '../domain/guideImages';
import { useT } from '../i18n';

/** What the problem looks like: a credited photo, or a drawing marked as one. Nothing if there's none. */
export function GuidePicture({ id, alt, compact = false }: { id: string | null | undefined; alt: string; compact?: boolean }) {
  const t = useT();
  const img = id ? guideImage(id) : null;
  if (!img) return null;
  return (
    <figure className={`guide-pic${compact ? ' guide-pic-compact' : ''}`}>
      <img src={img.url} alt={alt} loading="lazy" decoding="async" />
      <figcaption>
        {img.kind === 'photo' ? t('guide.photoBy', { credit: img.credit }) : t('guide.drawing')}
        {img.source && !compact && <> · <a href={img.source} target="_blank" rel="noreferrer">{t('guide.source')}</a></>}
      </figcaption>
    </figure>
  );
}

export function GuideThumb({ id }: { id: string }) {
  const img = guideImage(id);
  return img ? <img className="guide-thumb" src={img.url} alt="" loading="lazy" decoding="async" /> : null;
}
