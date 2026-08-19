import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getCatalog,
  readStoredLocale,
  translate,
  writeStoredLocale,
  type Locale,
  type TranslationDict,
} from "./catalog";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: TranslationDict;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function applyDocumentLang(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // First visit always starts in English; a saved choice (Settings) still wins.
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? "en");

  useEffect(() => {
    applyDocumentLang(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
    applyDocumentLang(next);
  }, []);

  const dict = useMemo(() => getCatalog(locale), [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars),
    [dict],
  );

  const value = useMemo(() => ({ locale, setLocale, t, dict }), [locale, setLocale, t, dict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Convenience alias — same as `useI18n().t`. */
export function useTranslation() {
  const { t, locale, setLocale, dict } = useI18n();
  return { t, locale, setLocale, dict };
}
