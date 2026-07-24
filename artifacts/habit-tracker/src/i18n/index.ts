export type { Locale, TranslationDict } from "./catalog";
export {
  LOCALES,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  getCatalog,
  isLocale,
  readStoredLocale,
  translate,
  writeStoredLocale,
} from "./catalog";
export { I18nProvider, useI18n, useTranslation } from "./provider";
