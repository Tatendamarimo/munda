import type { Lang } from './langs';

/**
 * Day and month names for languages browsers have no calendar for (Intl falls back to English).
 * Drafts like the rest of the Shona and Ndebele text: to be checked by native speakers.
 */
interface Calendar {
  days: readonly string[]; // Sunday first
  months: readonly string[];
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  yesterday: string;
  daysAgo: (n: number) => string;
  justNow: string;
}

export const CALENDARS: Partial<Record<Lang, Calendar>> = {
  sn: {
    days: ['Svondo', 'Muvhuro', 'Chipiri', 'Chitatu', 'China', 'Chishanu', 'Mugovera'],
    months: ['Ndira', 'Kukadzi', 'Kurume', 'Kubvumbi', 'Chivabvu', 'Chikumi', 'Chikunguru', 'Nyamavhuvhu', 'Gunyana', 'Gumiguru', 'Mbudzi', 'Zvita'],
    minutesAgo: (n) => `maminitsi ${n} apfuura`,
    hoursAgo: (n) => (n === 1 ? 'awa rimwe rapfuura' : `maawa ${n} apfuura`),
    yesterday: 'nezuro',
    daysAgo: (n) => `mazuva ${n} apfuura`,
    justNow: 'izvozvi',
  },
  nd: {
    days: ['iSonto', 'uMvulo', 'uLwesibili', 'uLwesithathu', 'uLwesine', 'uLwesihlanu', 'uMgqibelo'],
    months: ['uZibandlela', 'uNhlolanja', 'uMbimbitho', 'uMabasa', 'uNkwenkwezi', 'uNhlangula', 'uNtulikazi', 'uNcwabakazi', 'uMpandula', 'uMfumfu', 'uLwezi', 'uMpalakazi'],
    minutesAgo: (n) => `imizuzu engu-${n} edlulileyo`,
    hoursAgo: (n) => `amahola angu-${n} adlulileyo`,
    yesterday: 'izolo',
    daysAgo: (n) => `insuku ezingu-${n} ezedlulileyo`,
    justNow: 'khathesi',
  },
};
