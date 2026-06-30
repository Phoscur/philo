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
    'action.publish': 'Publish via Github 🚡', // 🚀
    'action.cancel': 'Cancel ❌',
    'animation.takingShot': 'Taking a shot 🥃...',
    'message.takingPhotograph': 'Taking image now...',
    'message.takingTimelapse': 'Starting timelapse now!',
    'message.sharingToChannel': 'Sharing to Channel!',
    'message.canceling': 'Canceling!',
    'message.noPermission': 'Not permitted.',
    'message.noUsername': 'Username is required for uniqueness!',
    'timelapse.tooManyErrors': '❌ Too many errors while creating the timelapse',
  },
  de: {
    'action.presetSwitch': 'Einstellung wechseln 📷',
    'action.shotSingle': 'Schüsschen 🥃',
    'action.timelapse': 'Zeitraffer jetzt 🎥',
    'action.timelapse-half': 'Halber 🎥',
    'action.timelapse-third': 'Drittel 🎥',
    'action.timelapse-short': 'Kurz 🎥',
    'action.timelapse-super-short': 'Super Kurz 🎥',
    'action.shareToChannel': 'Teilen via Channel 📢',
    'action.publish': 'Veröffentlichen via Github 🚡', // 🚀
    'action.cancel': 'Abbrechen ❌',
    'animation.takingShot': 'Ein Schuss 🥃...',
    'message.takingPhotograph': 'Schieße jetzt...',
    'message.takingTimelapse': 'Starte die Zeitrafferaufnahme!',
    'message.sharingToChannel': 'Teile im Channel!',
    'message.canceling': 'Breche ab!',
    'message.noPermission': 'Nicht zugelassen.',
    'message.noUsername': 'Hierfür wird ein Username zur Eindeutigkeit benötigt!',
    'timelapse.tooManyErrors': '❌ Zu viele Fehler beim Erstellen des Zeitraffers',
  },
} as const;

type BasicIndex = (typeof base)[typeof defaultLang];
type BasicEntry = keyof BasicIndex;
export type SlottedTranslate = (index: BasicIndex, ...args: BasicEntry[]) => string;

export function dateFormat(d = new Date()) {
  const clock = d.toLocaleTimeString().slice(0, 5);
  // js dates are the best, I don't regret to have removed dayjs at all!!11
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${clock}`;
}

const composite = {
  // requires the BasicIndex to be fully translated to compose!
  en: {
    'message.preset': (t: BasicIndex, name: string) => `Selected ${name} 📷, updating...`,
    'caption.options': (t: BasicIndex, name: string, presetName: string, presetText: string) =>
      `${name}\nSelected options: ${presetName} 📷\n${presetText}`,
    'storage.status': (t: BasicIndex, size: string, used: string, percent: string) =>
      `💾 Storage (${used}/${size}): ${percent}`,
    'timelapse.frameTaken': (t: BasicIndex, filename: string) =>
      `📷 Last Timelapse frame created:\n${filename}`,
    'timelapse.frameRendered': (t: BasicIndex, frame: string, fps: string) =>
      `🎞️ Rendered Frames: ${frame} (${fps} FPS)`,
    'sunset.start': (t: BasicIndex, hardwareStatus: string) =>
      `🌇 Sunset is soon...\n⤵️ Starting daily timelapse 🎥\n${hardwareStatus}`,
    'sunset.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `${cloud}🌇 ${rated} ${dateFormat(d)}`,
    'timelapse.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `🎥${cloud} ${rated} ${dateFormat(d)}`,
    'shot.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `${cloud} ${rated} ${dateFormat(d)}`,
    'date.title': (t: BasicIndex, d = new Date()) => dateFormat(d),
    'caption.status': (t: BasicIndex, shared = false, published = false) =>
      `- shared ${shared ? '✔️' : '✖️'}- published ${published ? '✔️' : '✖️'}`,
  },
  de: {
    'message.preset': (t: BasicIndex, name: string) =>
      `Preset ${name} 📷 ausgewählt, aktualisiere...`,
    'caption.options': (t: BasicIndex, name: string, presetName: string, presetText: string) =>
      `${name}\nKamera Voreinstellung: ${presetName} 📷\n${presetText}`,
    'storage.status': (t: BasicIndex, size: string, used: string, percent: string) =>
      `💾 Speicherplatz (${used}/${size}): ${percent}`,
    'timelapse.frameTaken': (t: BasicIndex, filename: string) =>
      `📷 Letztes aufgenommenes Bild:\n${filename}`,
    'timelapse.frameRendered': (t: BasicIndex, frame: string, fps: string) =>
      `🎞️ Gerenderte Videobilder: ${frame} (${fps} FPS)`,
    'sunset.start': (t: BasicIndex, hardwareStatus: string) =>
      `🌇 Sonnenuntergang ist schon bald...\n⤵️ Starte den täglichen Zeitraffer 🎥\n${hardwareStatus}`, // alternate icon: 🌆
    'sunset.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `${cloud}🌇 ${rated} ${dateFormat(d)}`,
    'timelapse.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `🎥${cloud} ${rated} ${dateFormat(d)}`,
    'shot.title': (t: BasicIndex, d = new Date(), cloud = '', rated = '') =>
      `${cloud} ${rated} ${dateFormat(d)}`,
    'date.title': (t: BasicIndex, d = new Date()) => dateFormat(d),
    'caption.status': (t: BasicIndex, shared = false, _published = false) =>
      `- geteilt ${shared ? '✔️' : '✖️'}`, //- veröffentlicht ${_published ? '✔️' : '✖️'}`,
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
