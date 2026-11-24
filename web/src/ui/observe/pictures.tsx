import { useId } from 'react';
import type { ReactNode } from 'react';
import type { AffectedArea, CropStage, Onset, Rainfall } from '../../domain/models';
import { MaizePlant } from '../illustrations/MaizePlant';

/** A coherent set of field diagrams, drawn for legibility at a two-column phone size. */
function Frame({ children, sky = false }: { children: ReactNode; sky?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 200 112" aria-hidden="true" preserveAspectRatio="xMidYMid meet" fill="none">
    <defs><linearGradient id={id} x1="0" y1="0" x2="200" y2="112" gradientUnits="userSpaceOnUse"><stop stopColor={sky ? '#ECF3F5' : '#F2F3E8'} /><stop offset="1" stopColor={sky ? '#D8E6EA' : '#E1E8D8'} /></linearGradient></defs>
    <rect width="200" height="112" rx="14" fill={`url(#${id})`} />{children}
  </svg>;
}
const Unknown = () => <Frame><circle cx="100" cy="56" r="23" fill="#FAFBF6" stroke="#BECBBB" /><path d="M94 49C94 39 109 40 109 49C109 54 100 55 100 62" stroke="#65806A" strokeWidth="2.5" strokeLinecap="round" /><circle cx="100" cy="71" r="1.7" fill="#65806A" /></Frame>;

function Field({ kind }: { kind: AffectedArea }) {
  const sick = (col: number, row: number) => kind === 'MOST_OF_FIELD' ? !(col === 3 && row === 1) : kind === 'FIELD_EDGES' ? col === 0 || col === 6 || row === 0 || row === 3 : kind === 'LOW_SPOTS' ? row > 1 && col > 2 && col < 6 : kind === 'PATCHES' ? (col < 2 && row < 2) || (col > 4 && row > 1) : (col === 2 && row === 1) || (col === 5 && row === 2);
  return <Frame>
    <path d="M27 27L168 19L181 91L22 99Z" fill="#C9D7B7" stroke="#8CA781" strokeWidth="1" />
    <path d="M27 27L168 19L169 25L27 33Z" fill="#E6DCC0" />
    <path d="M22 99L181 91L182 95L22 103Z" fill="#B5C59F" />
    {kind === 'LOW_SPOTS' && <path d="M84 77C112 61 167 66 174 86C150 98 104 97 84 89Z" fill="#B3CED1" stroke="#8EADB7" strokeWidth=".7" />}
    {[0,1,2,3].map((row) => <g key={row} transform={`translate(0 ${row * 16})`}>
      <path d={`M30 ${39 - row}L171 ${31 - row}`} stroke="#90A67C" strokeWidth=".7" opacity=".6" />
      {[0,1,2,3,4,5,6].map((col) => <g key={col} transform={`translate(${36 + col * 21} ${34 - col * 1.1})`}>
        {sick(col,row) && <ellipse cx="0" cy="3" rx="7" ry="4" fill="#E7CF7C" opacity=".7" />}
        <path d="M0 4V-5M0 0C-7 -7 -8 -3 -7 -2C-4 1 -2 1 0 2M0 -2C5 -9 9 -7 7 -4C5 -1 3 0 0 0" stroke={sick(col,row) ? '#997829' : '#436B42'} strokeWidth="1" fill={sick(col,row) ? '#D7B75C' : '#6D8C54'} strokeLinecap="round" />
      </g>)}
    </g>)}
  </Frame>;
}
export const areaPicture = (a: AffectedArea): ReactNode => a === 'UNKNOWN' ? <Unknown /> : <Field kind={a} />;

function Weather({ kind }: { kind: Rainfall }) {
  const sunny = kind === 'NONE';
  const flood = kind === 'FLOODING';
  const heavy = kind === 'HEAVY' || flood;
  return <Frame sky>
    <circle cx={sunny ? 100 : 72} cy={sunny ? 37 : 32} r={sunny ? 18 : 14} fill="#E4BD55" opacity={heavy ? .15 : 1} />
    {sunny && <g stroke="#E4BD55" strokeWidth="1.5" strokeLinecap="round">{Array.from({length:8},(_,i) => {const a=i*Math.PI/4;return <path key={i} d={`M${100+Math.cos(a)*23} ${37+Math.sin(a)*23}l${Math.cos(a)*5} ${Math.sin(a)*5}`} />;})}</g>}
    {!sunny && <><path d="M67 47C55 47 54 32 66 29C68 12 94 12 100 27C111 21 123 29 123 37C140 36 141 50 128 51H70Z" fill={heavy ? '#78949B' : '#FAFCFB'} /><path d="M67 47C89 53 113 47 134 46" stroke={heavy ? '#66858E' : '#CEDDE1'} strokeWidth="1.3" />
    {Array.from({length:heavy ? 8 : 3},(_,i) => <path key={i} d={`M${69+i*(heavy ? 9 : 20)} ${59+(i%2)*9}l-3 ${heavy ? 10 : 6}`} stroke={heavy ? '#4F8198' : '#7D9FAD'} strokeWidth="1.8" strokeLinecap="round" />)}</>}
    <path d="M0 94C35 83 69 91 103 86C141 81 165 83 200 87V112H0Z" fill={sunny ? '#DBCA9E' : '#C4D4BB'} />
    <path d="M0 102C58 91 143 104 200 94" stroke={sunny ? '#B6A16D' : '#90AB83'} strokeWidth="1" />
    {sunny && <g stroke="#B49C6D" strokeWidth="1" opacity=".7"><path d="M67 93l5 8-4 7M72 101l12 3M128 90l-5 9 7 7M123 99l-12 1" /></g>}
    {flood && <><path d="M0 86C35 82 74 91 107 86C140 81 166 88 200 84V112H0Z" fill="#A6C9D1" /><path d="M21 96h29m19 7h36m19-9h39m-10 12h24" stroke="#E3F0F0" strokeWidth="1.5" strokeLinecap="round" /><path d="M98 98V79m0 11c-5 -8 -11 -7 -13 -6m13 2c6 -10 10 -8 13 -7" stroke="#4F7352" strokeWidth="1.6" /></>}
  </Frame>;
}
export const rainPicture = (r: Rainfall): ReactNode => r === 'UNKNOWN' ? <Unknown /> : <Weather kind={r} />;

function Calendar({ kind }: { kind: Onset }) {
  const from = kind === 'RECENT' ? 12 : kind === 'THIS_WEEK' ? 7 : 0;
  const to = kind === 'ONE_TO_TWO_WEEKS' ? 6 : kind === 'LONGER' ? 2 : 13;
  return <Frame>
    <rect x="47" y="22" width="111" height="78" rx="10" fill="#B4C0AC" opacity=".18" />
    <rect x="44" y="17" width="111" height="78" rx="10" fill="#FCFDF8" stroke="#C6D2BF" />
    <path d="M44 39h111" stroke="#E0E7D9" />
    <path d="M67 12v12M132 12v12" stroke="#577657" strokeWidth="3" strokeLinecap="round" />
    <path d="M85 28h29" stroke="#D1DCC8" strokeWidth="3" strokeLinecap="round" />
    {Array.from({length:14},(_,i) => <g key={i}><rect x={54+i%7*13} y={48+Math.floor(i/7)*20} width="9" height="12" rx="3" fill={i>=from && i<=to ? '#D8B252' : '#E7ECDF'} />{i===13 && <rect x={52+i%7*13} y="66" width="13" height="16" rx="5" stroke="#476F50" strokeWidth="1.2" />}</g>)}
    {kind === 'LONGER' && <g fill="#A3B392"><circle cx="23" cy="55" r="2"/><circle cx="30" cy="55" r="2"/><circle cx="37" cy="55" r="2"/></g>}
  </Frame>;
}
export const onsetPicture = (o: Onset): ReactNode => o === 'UNKNOWN' ? <Unknown /> : <Calendar kind={o} />;

const STAGES: Record<Exclude<CropStage,'UNKNOWN'>,number> = { EMERGENCE:0, EARLY_GROWTH:1, LATE_GROWTH:2, TASSELING:3, GRAIN_FILL:4, MATURITY:5 };
export function stagePicture(s: CropStage): ReactNode {
  if (s === 'UNKNOWN') return <Unknown />;
  return <Frame>
    <path d="M0 98C55 91 127 96 200 94V112H0Z" fill="#D4C8A7" />
    <path d="M15 105C68 101 135 105 183 100" stroke="#B4A57E" strokeWidth=".7" />
    <ellipse cx="100" cy="99" rx="24" ry="3" fill="#859467" opacity=".15" />
    <MaizePlant x="58" y="-8" width="84" height="117" stage={STAGES[s]} />
    <g stroke="#AFBEA2" strokeWidth=".7"><path d="M169 21v75m-3-75h6m-6 25h6m-6 25h6m-6 25h6" /></g>
  </Frame>;
}
