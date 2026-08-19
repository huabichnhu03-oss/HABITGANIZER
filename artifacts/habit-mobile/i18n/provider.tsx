import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import {
  getCatalog,
  isLocale,
  LOCALE_STORAGE_KEY,
  translate,
  type Locale,
  type TranslationDict,
} from "../../habit-tracker/src/i18n/catalog";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: TranslationDict;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (!cancelled && isLocale(raw)) setLocaleState(raw);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

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

export function useTranslation() {
  const { t, locale, setLocale, dict } = useI18n();
  return { t, locale, setLocale, dict };
}
