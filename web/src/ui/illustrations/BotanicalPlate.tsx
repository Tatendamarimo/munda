import { useId } from 'react';
import { MaizePlant } from './MaizePlant';

/** Schematic symptom plates based on the existing written guide, not diagnostic photographs. */
export function BotanicalPlate({ problem, thumbnail = false }: { problem: string; thumbnail?: boolean }) {
  const id = useId().replace(/:/g, '');
  const leaf = 'M207 161C214 94 310 45 444 31C399 116 304 157 207 161Z';
  const root = problem === 'termites' || problem === 'acid_soil';
  const sulfur = problem === 'sulfur';
  return <svg className="botanical-plate" viewBox={thumbnail ? '185 18 275 160' : '0 0 480 240'} role={thumbnail ? undefined : 'img'} aria-hidden={thumbnail || undefined} aria-label={thumbnail ? undefined : 'Schematic illustration'} fill="none">
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="480" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#F4F2E8" /><stop offset="1" stopColor="#E8EDDF" /></linearGradient>
      <linearGradient id={`${id}-blade`} x1="207" y1="161" x2="444" y2="31" gradientUnits="userSpaceOnUse"><stop stopColor={sulfur ? '#B9BB6C' : '#3C6541'} /><stop offset=".5" stopColor={sulfur ? '#D8D68A' : '#739153'} /><stop offset="1" stopColor={sulfur ? '#E1D791' : '#9EB172'} /></linearGradient>
      <clipPath id={`${id}-clip`}><path d={leaf} /></clipPath>
    </defs>
    <path d="M0 0H480V240H0Z" fill={`url(#${id}-paper)`} />
    <g stroke="#B5C1AC" strokeWidth=".6" opacity=".6"><path d="M24 24h14m-14 0v14m432-14h-14m14 0v14M24 216h14m-14 0v-14m432 14h-14m14 0v-14M170 30v180" /></g>
    <ellipse cx="93" cy="213" rx="49" ry="5" fill="#748765" opacity=".1" />
    <MaizePlant x="34" y="24" width="126" height="190" stage={3} stress={sulfur ? 'upper' : problem === 'nitrogen' || problem === 'magnesium' ? 'lower' : problem === 'acid_soil' ? 'whole' : 'none'} />
    {!root ? <>
      <path d={leaf} fill={`url(#${id}-blade)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {Array.from({length:11},(_,i) => <path key={i} d={`M${197+i*1.7} ${164+i*2}Q${300+i*2} ${75+i*3} ${450+i*2} ${19+i*2}`} stroke="#D5DBAF" strokeWidth=".65" opacity=".55" />)}
        {problem === 'nitrogen' && <path d="M444 31C375 75 315 108 268 132C326 109 372 99 408 79Z" fill="#DDCF79" opacity=".95" />}
        {problem === 'magnesium' && Array.from({length:6},(_,i) => <path key={i} d={`M${231+i*8} ${163-i*2}Q${327+i*7} ${95+i*2} ${445+i*4} ${25+i*6}`} stroke={i%2 ? '#C1BA63' : '#D6CD79'} strokeWidth="4.5" opacity=".9" />)}
        {problem === 'streak_virus' && Array.from({length:9},(_,i) => <path key={i} d={`M${215+i*6} ${154+i*1.6}Q${325+i*4} ${79+i*5} ${459+i} ${14+i*7}`} stroke="#E6DD9E" strokeWidth="1.6" strokeDasharray={`${5+i%3*3} ${4+i%2*4}`} opacity=".9" />)}
      </g>
      <path d="M207 161Q321 106 444 31" stroke="#DDE1BA" strokeWidth="1.2" />
      <path d="M203 163l-16 10" stroke="#6C8555" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M227 187H423" stroke="#A2B294" strokeWidth=".6" />
      <path d="M227 184v6m196-6v6" stroke="#A2B294" strokeWidth=".6" />
    </> : <g>
      <path d="M202 110C271 102 345 117 450 105V211H202Z" fill="#C5B58B" opacity=".35" />
      <path d="M202 110C271 102 345 117 450 105" stroke="#A99467" strokeWidth="1" />
      <path d="M302 51C300 83 308 102 305 126" stroke="#6B7950" strokeWidth="5" />
      <path d="M302 83C284 58 263 63 250 68C271 67 290 81 303 91M304 73C318 49 341 47 353 54C333 52 321 65 305 81" fill="#739056" />
      <g stroke="#8A7953" strokeWidth="1.2" strokeLinecap="round"><path d="M305 123C289 141 289 164 278 187M305 123C314 145 332 154 341 180M305 123C299 153 306 171 301 196M294 148L277 155l-7 17M319 146l17 6 12 15M300 168l-13 7-7 17" />{problem !== 'acid_soil' && <path d="M288 159l-19 9-12 19M328 165l18 4 11 18M302 179l13 8 1 19" />}</g>
      {problem === 'termites' && <><path d="M300 123l-5-10 4-11-3-10 3-13" stroke="#A18A60" strokeWidth="5" strokeLinecap="round" /><g transform="translate(393 157) rotate(-25)"><ellipse rx="7" ry="14" fill="#E8DFC2" stroke="#9D8B64" strokeWidth=".8" /><ellipse cy="-17" rx="5" ry="5" fill="#A58C58" /><path d="M-4-6l-9-4m9 11-10 2m11 5-8 7M4-6l9-4M4 1l10 2M3 6l8 7M-3-21l-4-7m10 7 4-7M-6 0H6m-12 5h12m-10 5h8" stroke="#9D8B64" strokeWidth=".8" /></g></>}
    </g>}
  </svg>;
}
