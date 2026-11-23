import type { ReactNode } from 'react';
import type { AffectedArea, CropStage, Onset, Rainfall } from '../../domain/models';

/**
 * Small drawings for each answer, so a farmer who reads little can still answer by looking.
 * One 160×60 canvas each, flat colours from the palette, no text inside.
 */
const SOIL = '#cdbb94';
const LEAF = '#3f7a2f';
const SICK = '#e2b92e';
const SKY = '#dcebf5';
const RAIN = '#2d6a9a';

const Frame = ({ bg = SOIL, children }: { bg?: string; children: ReactNode }) => (
  <svg viewBox="0 0 160 60" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <rect width="160" height="60" fill={bg} />
    {children}
  </svg>
);

/** A row of plants; `sick` lists the indexes drawn yellow. */
function Plants({ sick, y = 14, h = 34 }: { sick: (i: number, row: number) => boolean; y?: number; h?: number }) {
  const out: ReactNode[] = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 9; i++) {
      out.push(<rect key={`${row}-${i}`} x={10 + i * 16 + row * 8} y={y + row * 6} width="7" height={h - row * 10} rx="3" fill={sick(i, row) ? SICK : LEAF} />);
    }
  }
  return <>{out}</>;
}

const Unknown = () => (
  <Frame bg="#ece9df">
    <circle cx="80" cy="30" r="18" fill="none" stroke="#8a948c" strokeWidth="4" />
    <path d="M73 25a7 7 0 1 1 10 6c-2 1-3 2-3 5" fill="none" stroke="#8a948c" strokeWidth="4" strokeLinecap="round" />
    <circle cx="80" cy="42" r="2.5" fill="#8a948c" />
  </Frame>
);

export function areaPicture(a: AffectedArea): ReactNode {
  switch (a) {
    case 'FEW_PLANTS': return <Frame><Plants sick={(i) => i === 2 || i === 6} /></Frame>;
    case 'PATCHES': return <Frame><Plants sick={(i) => i <= 2 || (i >= 6 && i <= 7)} /></Frame>;
    case 'LOW_SPOTS': return (
      <Frame>
        <path d="M0 44 Q80 62 160 44 V60 H0Z" fill="#8fb3cf" />
        <Plants sick={(i) => i >= 3 && i <= 6} />
      </Frame>
    );
    case 'FIELD_EDGES': return <Frame><Plants sick={(i) => i === 0 || i === 8} /></Frame>;
    case 'MOST_OF_FIELD': return <Frame><Plants sick={(i) => i !== 4} /></Frame>;
    case 'UNKNOWN': return <Unknown />;
  }
}

const Cloud = ({ x = 80, dark = false }: { x?: number; dark?: boolean }) => (
  <path d={`M${x - 26} 26a12 12 0 0 1 10-14 15 15 0 0 1 28 2 10 10 0 0 1 14 12z`} fill={dark ? '#7c8f9e' : '#ffffff'} />
);
const Drops = ({ n }: { n: number }) => (
  <>{Array.from({ length: n }, (_, i) => <line key={i} x1={58 + i * 9} y1={34 + (i % 2) * 5} x2={55 + i * 9} y2={44 + (i % 2) * 5} stroke={RAIN} strokeWidth="3" strokeLinecap="round" />)}</>
);

export function rainPicture(r: Rainfall): ReactNode {
  switch (r) {
    case 'NONE': return (
      <Frame bg="#fdf1c7">
        <circle cx="80" cy="30" r="13" fill="#f2b705" />
        {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={80 + Math.cos(a) * 18} y1={30 + Math.sin(a) * 18} x2={80 + Math.cos(a) * 25} y2={30 + Math.sin(a) * 25} stroke="#f2b705" strokeWidth="3" strokeLinecap="round" />; })}
      </Frame>
    );
    case 'LIGHT': return <Frame bg={SKY}><Cloud /><Drops n={2} /></Frame>;
    case 'HEAVY': return <Frame bg="#c9dbe8"><Cloud dark /><Drops n={5} /></Frame>;
    case 'FLOODING': return (
      <Frame bg="#c9dbe8">
        <Cloud dark /><Drops n={4} />
        <path d="M0 46 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V60 H0Z" fill={RAIN} opacity=".75" />
      </Frame>
    );
    case 'UNKNOWN': return <Unknown />;
  }
}

/** A week strip: the highlighted days are when it started. */
function Days({ from, to, faded = false }: { from: number; to: number; faded?: boolean }) {
  return (
    <Frame bg="#f4f1e6">
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={8 + i * 10.4} y="20" width="8" height="20" rx="2" fill={i >= from && i <= to ? (faded ? '#c9a54a' : '#f2b705') : '#ddd8c6'} />
      ))}
      <rect x={8 + 13 * 10.4 - 1} y="17" width="10" height="26" rx="3" fill="none" stroke="#14633a" strokeWidth="2" />
    </Frame>
  );
}

export function onsetPicture(o: Onset): ReactNode {
  switch (o) {
    case 'RECENT': return <Days from={12} to={13} />;
    case 'THIS_WEEK': return <Days from={7} to={13} />;
    case 'ONE_TO_TWO_WEEKS': return <Days from={0} to={7} />;
    case 'LONGER': return <Days from={0} to={2} faded />;
    case 'UNKNOWN': return <Unknown />;
  }
}

/** Maize at each stage: height, then tassel, then cob. */
function Maize({ h, tassel = false, cob = false, dry = false }: { h: number; tassel?: boolean; cob?: boolean; dry?: boolean }) {
  const c = dry ? '#b99b55' : LEAF;
  const top = 56 - h;
  return (
    <Frame bg="#f1ecdc">
      <rect x="0" y="54" width="160" height="6" fill={SOIL} />
      <rect x="78" y={top} width="4" height={h} fill={c} />
      {h > 10 && <path d={`M80 ${top + h * 0.55} q-22 -4 -30 -14 q16 2 30 8z M80 ${top + h * 0.35} q22 -4 30 -14 q-16 2 -30 8z`} fill={c} />}
      {tassel && <path d={`M80 ${top} l-6 -6 M80 ${top} l0 -8 M80 ${top} l6 -6`} stroke="#c9a54a" strokeWidth="2.5" strokeLinecap="round" />}
      {cob && <ellipse cx="88" cy={top + h * 0.5} rx="4" ry="9" fill={dry ? '#d9b45a' : '#f2d36b'} />}
    </Frame>
  );
}

export function stagePicture(s: CropStage): ReactNode {
  switch (s) {
    case 'EMERGENCE': return <Maize h={8} />;
    case 'EARLY_GROWTH': return <Maize h={20} />;
    case 'LATE_GROWTH': return <Maize h={36} />;
    case 'TASSELING': return <Maize h={42} tassel />;
    case 'GRAIN_FILL': return <Maize h={42} tassel cob />;
    case 'MATURITY': return <Maize h={42} cob dry />;
    case 'UNKNOWN': return <Unknown />;
  }
}
