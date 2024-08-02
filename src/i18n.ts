export const languages = {
  en: 'English',
  de: 'Deutsch',
};

export const defaultLang = (process.env.LANGUAGE as keyof typeof languages) ?? 'en';

const base = {
  en: {
    'action.presetSwitch': 'Switch Preset 📷',
    'action.shotSingle': 'Single Shot 🥃',
    'action.timelapse': 'Timelapse now 🎥',
    'action.timelapse-half': 'Half 🎥',
    'action.timelapse-third': 'Third 🎥',
    'action.timelapse-short': 'Short 🎥',
    'action.timelapse-super-short': 'Super Short 🎥',
    'action.shareToChannel': 'Share via Channel 📢',
    'action.cancel': 'Cancel',
    'animation.takingShot': 'Taking a shot 🥃...',
  },
  de: {
    'action.presetSwitch': 'Einstellung wechseln 📷',
    'action.shotSingle': 'Einzelschuss 🥃',
    'action.timelapse': 'Zeitraffer jetzt 🎥',
    'action.timelapse-half': 'Halber 🎥',
    'action.timelapse-third': 'Drittel 🎥',
    'action.timelapse-short': 'Kurz 🎥',
    'action.timelapse-super-short': 'Super Kurz 🎥',
    'action.shareToChannel': 'Teilen via Channel 📢',
    'action.cancel': 'Abbrechen',
    'animation.takingShot': 'Ein Schuss 🥃...',
  },
} as const;

type BasicIndex = (typeof base)[typeof defaultLang];
type BasicEntry = keyof BasicIndex;
export type SlottedTranslate = (index: BasicIndex, ...args: BasicEntry[]) => string;

const composite = {
  // requires the BasicIndex to be fully translated to compose!
  en: {
    greet: (t: BasicIndex, name: string) => `Hey ${name}`,
    'caption.options': (t: BasicIndex, name: string, presetName: string, presetText: string) =>
      `${name}\nSelected options: ${presetName} 📷\n${presetText}`,
    titleDate: (t: BasicIndex, d = new Date()) =>
      `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}`,
  },
  de: {
    'caption.options': (t: BasicIndex, name: string, presetName: string, presetText: string) =>
      `${name}\nKamera Voreinstellung: ${presetName} 📷\n${presetText}`,
    titleDate: (t: BasicIndex, d = new Date()) =>
      `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}`,
  },
} as const;

type EntriesSlotsIndex = (typeof composite)[typeof defaultLang];
type EntryWithSlots = keyof EntriesSlotsIndex;

export const index = {
  en: {
    ...base.en,
    ...composite.en,
  },
  de: {
    ...base.de,
    ...composite.de,
  },
} as const;

export type TranslationIndex = (typeof index)[typeof defaultLang];
export type Entry = keyof TranslationIndex;
export type Language = keyof typeof languages;

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in base) return lang as Language;
  return defaultLang;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export type I18n = <Key extends Entry>(
  key: Key,
  ...slots: Key extends EntryWithSlots ? Tail<Parameters<EntriesSlotsIndex[Key]>> : []
) => string;

const FALLBACK_LANGUAGE: Language = defaultLang;

export function useTranslations(lang: Language = defaultLang): I18n {
  return function t(key, ...slots) {
    const translations = index[lang] as TranslationIndex;
    let f = translations[key];
    // eslint-disable-next-line  @typescript-eslint/no-unnecessary-condition
    if (FALLBACK_LANGUAGE && !f) {
      f = (index[FALLBACK_LANGUAGE] as TranslationIndex)[key];
    }
    if (typeof f === 'string') {
      return f;
    }
    // we only use types for autocompletion and compile time checking, there are no runtime checks if given slots actually match
    return (f as SlottedTranslate)(translations, ...(slots as Tail<Parameters<SlottedTranslate>>));
  };
}

// inspired by https://docs.astro.build/en/recipes/i18n/
