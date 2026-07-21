import Constants from "expo-constants";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalize(url: string | undefined | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return stripTrailingSlash(trimmed);
  return stripTrailingSlash(`https://${trimmed}`);
}

function readExtra(key: string): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const value = extra[key];
  return typeof value === "string" ? value : undefined;
}

export const API_URL: string =
  normalize(process.env.EXPO_PUBLIC_API_URL) ||
  normalize(readExtra("apiUrl")) ||
  normalize(process.env.EXPO_PUBLIC_DOMAIN);

export const WEB_ORIGIN: string =
  normalize(process.env.EXPO_PUBLIC_WEB_ORIGIN) ||
  normalize(readExtra("webOrigin")) ||
  API_URL;
