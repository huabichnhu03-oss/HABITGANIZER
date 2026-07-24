import { Linking, Platform } from "react-native";

import { API_URL } from "@/lib/config";

const ANDROID_PACKAGE = "com.habitpup.app";

/** Opens the native in-app review UI when available, otherwise the store listing. */
export async function requestAppRating(): Promise<void> {
  if (Platform.OS === "web") {
    await Linking.openURL(`${API_URL}/support`);
    return;
  }

  try {
    const StoreReview = await import("expo-store-review");
    const available = await StoreReview.isAvailableAsync();
    if (available && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // Package missing or unavailable — fall through to store URL.
  }

  const url = getStoreListingUrl();
  if (url) {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return;
    }
  }

  await Linking.openURL(`${API_URL}/support`);
}

function getStoreListingUrl(): string | null {
  if (Platform.OS === "android") {
    return `market://details?id=${ANDROID_PACKAGE}`;
  }
  if (Platform.OS === "ios") {
    const appStoreId = process.env.EXPO_PUBLIC_APP_STORE_ID?.trim();
    if (appStoreId) {
      return `itms-apps://itunes.apple.com/app/id${appStoreId}?action=write-review`;
    }
  }
  return null;
}
