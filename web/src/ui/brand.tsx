/**
 * Munda logo. The artwork lives in public/munda-logo.svg exactly as designed; the symbol and
 * wordmark files are the same artwork framed with a different viewBox (no paths changed).
 */
export const Mark = ({ size = 32 }: { size?: number }) => (
  <img src="/munda-symbol.svg" width={size} height={size} alt="" className="mark" />
);

export function Wordmark() {
  return (
    <span className="wordmark" role="img" aria-label="Munda">
      <img src="/munda-symbol.svg" alt="" className="wordmark-symbol" />
      <img src="/munda-wordmark.svg" alt="" className="wordmark-text" />
    </span>
  );
}

export const FullLogo = ({ width = 160 }: { width?: number }) => (
  <img src="/munda-logo.svg" width={width} alt="Munda" className="full-logo" />
);
