import { useId } from 'react';
import type { SVGProps } from 'react';

/** A shared botanical silhouette: tapered blades, midribs, nodes, husks and branching tassels. */
export function MaizePlant({ stage = 4, stress = 'none', ...props }: SVGProps<SVGSVGElement> & { stage?: number; stress?: 'none' | 'lower' | 'upper' | 'whole' }) {
  const id = useId().replace(/:/g, '');
  const dry = stage === 5;
  const leaves = [
    { d: 'M60 139C42 116 21 112 6 121C23 112 44 128 60 144Z', v: 'M60 141C42 125 23 115 6 121', n: 0 },
    { d: 'M61 123C85 91 110 95 119 112C105 99 85 108 61 129Z', v: 'M61 126C84 107 104 97 119 112', n: 1 },
    { d: 'M60 108C39 76 14 77 1 89C24 79 43 99 60 115Z', v: 'M60 112C39 93 19 78 1 89', n: 2 },
    { d: 'M61 93C79 60 103 55 117 64C95 60 78 83 61 101Z', v: 'M61 97C80 76 99 56 117 64', n: 3 },
    { d: 'M60 78C45 47 24 43 11 47C33 48 49 71 60 86Z', v: 'M60 82C45 62 31 46 11 47', n: 4 },
    { d: 'M61 67C65 39 75 23 88 18C77 32 70 51 61 75Z', v: 'M61 70C70 44 76 31 88 18', n: 5 },
  ];
  const count = stage === 0 ? 2 : stage === 1 ? 4 : 6;
  return <svg viewBox="0 0 120 180" fill="none" {...props}>
    <defs>
      <linearGradient id={`${id}-leaf`} x1="8" y1="40" x2="104" y2="140" gradientUnits="userSpaceOnUse"><stop stopColor={dry ? '#C7AD64' : '#7C9B58'} /><stop offset=".5" stopColor={dry ? '#AC8849' : '#3F6B40'} /><stop offset="1" stopColor={dry ? '#D5BC7E' : '#234D36'} /></linearGradient>
      <linearGradient id={`${id}-pale`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E5D37E" /><stop offset="1" stopColor="#A5AD58" /></linearGradient>
    </defs>
    <g transform={stage === 0 ? 'translate(24 88) scale(.6 .43)' : stage === 1 ? 'translate(13 42) scale(.78 .72)' : undefined}>
      <path d="M59 162C60 126 61 94 60 52" stroke={dry ? '#A4874F' : '#617E43'} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M60 159C60 123 62 95 61 56" stroke="#C3CD92" strokeWidth=".8" />
      {[86, 112, 139].map((y) => <path key={y} d={`M58 ${y}l5 -.5`} stroke={dry ? '#806B41' : '#355C37'} strokeWidth="1.6" />)}
      {leaves.slice(stage < 2 ? 6 - count : 0).map((l, i) => {
        const pale = stress === 'whole' || (stress === 'lower' && l.n < 2) || (stress === 'upper' && l.n > 3);
        return <g key={i}><path d={l.d} fill={`url(#${id}-${pale ? 'pale' : 'leaf'})`} /><path d={l.v} stroke={pale ? '#E9D99E' : dry ? '#E2CE97' : '#A5B77C'} strokeWidth=".65" opacity=".8" /></g>;
      })}
      {stage >= 3 && <g stroke="#AA995A" strokeWidth="1" strokeLinecap="round"><path d="M60 56V19M60 37L47 24M60 32L73 17M60 43L43 34M60 48L77 35" />{[21, 28, 36, 43].map((y, i) => <g key={y}><path d={`M${47 + i * 2} ${y + 5}l-2 -4M${71 + i} ${y - 2}l3 -5`} /><circle cx={60} cy={y} r="1.1" fill="#C2AA67" /></g>)}</g>}
      {stage >= 4 && <g transform="rotate(23 70 112)"><path d="M65 133C56 117 61 95 69 88C79 103 81 120 65 133Z" fill={dry ? '#B49C5F' : '#8D9D55'} /><path d="M66 126C63 113 66 101 70 94C75 108 75 119 66 126Z" fill="#E4C46E" /><path d="M68 120L72 101M65 112l8 1M66 118l6 1M67 106l7 1" stroke="#AF914B" strokeWidth=".7" /><path d="M69 94C72 89 75 88 77 88" stroke="#987A42" strokeWidth=".7" /></g>}
    </g>
  </svg>;
}
