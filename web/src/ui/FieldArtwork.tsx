import fieldStudy from '../assets/munda-field-study.jpg';

/** Decorative editorial illustration, bundled for offline use; not diagnostic reference imagery. */
export function FieldArtwork({ compact = false }: { compact?: boolean }) {
  return <img className={`field-art${compact ? ' field-art-small' : ''}`} src={fieldStudy} alt="" width="1000" height="667" decoding="async" />;
}
