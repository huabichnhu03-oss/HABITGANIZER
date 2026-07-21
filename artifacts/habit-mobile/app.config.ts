import type { ConfigContext, ExpoConfig } from "expo/config";

function clean(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const webOriginEnv = clean(process.env.EXPO_PUBLIC_WEB_ORIGIN);
  const apiUrlEnv = clean(process.env.EXPO_PUBLIC_API_URL);
  const replitDevDomain = clean(process.env.EXPO_PUBLIC_DOMAIN);
  const profile = clean(process.env.EAS_BUILD_PROFILE);

  const webOrigin = webOriginEnv
    ? withScheme(webOriginEnv)
    : replitDevDomain
      ? withScheme(replitDevDomain)
      : undefined;
  const apiUrl = apiUrlEnv ? withScheme(apiUrlEnv) : webOrigin;

  if (profile === "production" && (!webOriginEnv || !apiUrlEnv)) {
    const missing = [
      !apiUrlEnv ? "EXPO_PUBLIC_API_URL" : null,
      !webOriginEnv ? "EXPO_PUBLIC_WEB_ORIGIN" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    throw new Error(
      `${missing} must be set for production EAS builds. ` +
        "See artifacts/habit-mobile/STORE_SUBMISSION.md for setup instructions.",
    );
  }

  /** Google sample app IDs — replace via EXPO_PUBLIC_ADMOB_* in production. */
  const admobAndroidAppId =
    clean(process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID) ?? "ca-app-pub-3940256099942544~3347511713";
  const admobIosAppId =
    clean(process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID) ?? "ca-app-pub-3940256099942544~1458002511";

  const plugins: ExpoConfig["plugins"] = (config.plugins ?? []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-router") {
      const opts = (plugin[1] ?? {}) as Record<string, unknown>;
      const merged: [string, Record<string, unknown>] = [
        "expo-router",
        {
          ...opts,
          origin: webOrigin ?? opts.origin ?? "https://localhost/",
        },
      ];
      return merged;
    }
    return plugin;
  });

  plugins.push([
    "react-native-google-mobile-ads",
    {
      androidAppId: admobAndroidAppId,
      iosAppId: admobIosAppId,
    },
  ]);

  return {
    ...config,
    name: config.name ?? "HabitPup",
    slug: config.slug ?? "habitpup",
    plugins,
    extra: {
      ...(config.extra ?? {}),
      apiUrl: apiUrl ?? "",
      webOrigin: webOrigin ?? "",
    },
  };
};
