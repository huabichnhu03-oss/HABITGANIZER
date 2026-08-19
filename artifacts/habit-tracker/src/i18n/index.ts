export type { Locale, TranslationDict } from "./catalog";
export {
  LOCALES,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  getCatalog,
  headingTextTransform,
  isLocale,
  readStoredLocale,
  toIntlLocale,
  translate,
  writeStoredLocale,
} from "./catalog";
export { I18nProvider, useI18n, useTranslation } from "./provider";
