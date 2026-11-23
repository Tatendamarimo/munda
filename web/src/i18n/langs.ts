export type Lang = 'en' | 'sn' | 'nd' | 'sw' | 'fr' | 'pt' | 'es';

export interface LangInfo {
  /** Name in the language itself, shown in the picker. */
  native: string;
  /** English name, used in prompts ("Write all text values in …"). */
  english: string;
  /** Drafted, not yet checked by a native speaker. */
  beta: boolean;
  /** BCP 47 locale for Intl and speech voices. */
  locale: string;
}

export const LANGS: Record<Lang, LangInfo> = {
  en: { native: 'English', english: 'English', beta: false, locale: 'en' },
  sn: { native: 'chiShona', english: 'Shona', beta: false, locale: 'sn-ZW' },
  nd: { native: 'isiNdebele', english: 'Ndebele', beta: true, locale: 'nd-ZW' },
  sw: { native: 'Kiswahili', english: 'Swahili', beta: true, locale: 'sw-KE' },
  fr: { native: 'Français', english: 'French', beta: true, locale: 'fr-FR' },
  pt: { native: 'Português', english: 'Portuguese', beta: true, locale: 'pt-MZ' },
  es: { native: 'Español', english: 'Spanish', beta: true, locale: 'es-MX' },
};

export const LANG_CODES = Object.keys(LANGS) as Lang[];

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANG_CODES as string[]).includes(x);
