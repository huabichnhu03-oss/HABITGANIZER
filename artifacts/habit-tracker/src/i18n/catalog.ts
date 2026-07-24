import { en, type TranslationDict } from "./locales/en";
import { vi } from "./locales/vi";

export type Locale = "en" | "vi";

export const LOCALES: ReadonlyArray<{ code: Locale; labelKey: "en" | "vi" }> = [
  { code: "en", labelKey: "en" },
  { code: "vi", labelKey: "vi" },
];

export const LOCALE_STORAGE_KEY = "habiganize.locale";

const catalogs: Record<Locale, TranslationDict> = { en, vi };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const raw of candidates) {
    const code = raw.toLowerCase().split("-")[0];
    if (code === "vi") return "vi";
  }
  return "en";
}

export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore quota / private mode
  }
}

export function getCatalog(locale: Locale): TranslationDict {
  return catalogs[locale] ?? en;
}

/** Resolve dotted keys like "nav.today". Falls back to English, then the key. */
export function translate(
  dict: TranslationDict,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const fromDict = lookup(dict, key);
  const raw = fromDict ?? lookup(en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

function lookup(dict: TranslationDict, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export type { TranslationDict };
