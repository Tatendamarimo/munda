import type { Lang } from './langs';

/**
 * Day and month names for languages browsers have no calendar for (Intl falls back to English).
 * Drafts like the rest of the Shona and Ndebele text: to be checked by native speakers.
 */
export interface Calendar {
  days: readonly string[]; // Sunday first
  months: readonly string[];
  /** Templates with {n}; plain text so the Android app shares them (shared/i18n). */
  minutesAgo: string;
  hourAgo: string;
  hoursAgo: string;
  yesterday: string;
  daysAgo: string;
  justNow: string;
}

export const fill = (template: string, n: number) => template.replace('{n}', String(n));

export const CALENDARS: Partial<Record<Lang, Calendar>> = {
  sn: {
    days: ['Svondo', 'Muvhuro', 'Chipiri', 'Chitatu', 'China', 'Chishanu', 'Mugovera'],
    months: ['Ndira', 'Kukadzi', 'Kurume', 'Kubvumbi', 'Chivabvu', 'Chikumi', 'Chikunguru', 'Nyamavhuvhu', 'Gunyana', 'Gumiguru', 'Mbudzi', 'Zvita'],
    minutesAgo: 'maminitsi {n} apfuura',
    hourAgo: 'awa rimwe rapfuura',
    hoursAgo: 'maawa {n} apfuura',
    yesterday: 'nezuro',
    daysAgo: 'mazuva {n} apfuura',
    justNow: 'izvozvi',
  },
  nd: {
    days: ['iSonto', 'uMvulo', 'uLwesibili', 'uLwesithathu', 'uLwesine', 'uLwesihlanu', 'uMgqibelo'],
    months: ['uZibandlela', 'uNhlolanja', 'uMbimbitho', 'uMabasa', 'uNkwenkwezi', 'uNhlangula', 'uNtulikazi', 'uNcwabakazi', 'uMpandula', 'uMfumfu', 'uLwezi', 'uMpalakazi'],
    minutesAgo: 'imizuzu engu-{n} edlulileyo',
    hourAgo: 'ihola elilodwa elidlulileyo',
    hoursAgo: 'amahola angu-{n} adlulileyo',
    yesterday: 'izolo',
    daysAgo: 'insuku ezingu-{n} ezedlulileyo',
    justNow: 'khathesi',
  },
};
