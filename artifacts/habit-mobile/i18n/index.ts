import { I18nProvider, useI18n, useTranslation } from "./provider";

export type { Locale, TranslationDict } from "../../habit-tracker/src/i18n/catalog";
export {
  LOCALES,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  getCatalog,
  headingTextTransform,
  isLocale,
  translate,
  toIntlLocale,
} from "../../habit-tracker/src/i18n/catalog";
export { I18nProvider, useI18n, useTranslation };
