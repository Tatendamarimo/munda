import { BookOpen } from 'lucide-react';
import { BotanicalPlate } from './illustrations/BotanicalPlate';
import { guideImage, type GuideImage } from '../domain/guideImages';
import { useT } from '../i18n';

/** View the selected published panel; the bundled source image stays complete. */
function Photo({ image, alt, thumbnail = false }: { image: GuideImage; alt: string; thumbnail?: boolean }) {
  const c = image.crop;
  if (!c) return <img src={image.url} alt={alt} loading="lazy" decoding="async" />;
  return <svg className="guide-photo-panel" viewBox={`${c.x} ${c.y} ${c.width} ${c.height}`} role={thumbnail ? undefined : 'img'} aria-label={thumbnail ? undefined : alt} aria-hidden={thumbnail || undefined} preserveAspectRatio={thumbnail ? 'xMidYMid slice' : 'xMidYMid meet'}>
    <image href={image.url} x="0" y="0" width={c.sourceWidth} height={c.sourceHeight} />
  </svg>;
}

/** What the problem looks like: a credited photo, or a drawing marked as one. Nothing if there's none. */
export function GuidePicture({ id, alt, compact = false }: { id: string | null | undefined; alt: string; compact?: boolean }) {
  const t = useT();
  const img = id ? guideImage(id) : null;
  if (!img) return null;
  return (
    <figure className={`guide-pic${compact ? ' guide-pic-compact' : ''}`}>
      {img.kind === 'drawing' ? <BotanicalPlate problem={id!} /> : <Photo image={img} alt={alt} />}
      <figcaption>
        {img.kind === 'photo' ? t('guide.photoBy', { credit: img.credit }) : t('guide.drawing')}
        {img.source && !compact && <> · <a href={img.source} target="_blank" rel="noreferrer">{t('guide.source')}</a></>}
        {img.licenseUrl && <> · <a href={img.licenseUrl} target="_blank" rel="noreferrer">{t('guide.license')}</a></>}
      </figcaption>
    </figure>
  );
}

export function GuideThumb({ id }: { id: string }) {
  const img = guideImage(id);
  return img ? img.kind === 'drawing' ? <span className="guide-thumb botanical-thumb"><BotanicalPlate problem={id} thumbnail /></span> : <span className="guide-thumb"><Photo image={img} alt="" thumbnail /></span> : <span className="guide-thumb guide-reference-icon" aria-hidden="true"><BookOpen size={22} /></span>;
}
