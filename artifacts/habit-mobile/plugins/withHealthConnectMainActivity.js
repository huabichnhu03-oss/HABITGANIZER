/**
 * Injects HealthConnectPermissionDelegate into MainActivity (required by react-native-health-connect).
 * @see https://github.com/matinzd/react-native-health-connect#installation
 */
const { createRunOncePlugin, withMainActivity } = require("expo/config-plugins");

function withHealthConnectMainActivity(config) {
  return withMainActivity(config, async (config) => {
    // Expo config-plugins reports Kotlin as "kt" (see @expo/config-plugins Paths.getLanguage), not "kotlin".
    const lang = config.modResults.language;
    if (lang !== "kt" && lang !== "kotlin" && lang !== "java") {
      throw new Error(
        `[withHealthConnectMainActivity] Unsupported MainActivity language "${lang}"; expected kt, kotlin, or java.`,
      );
    }

    let contents = config.modResults.contents;
    if (!contents || contents.includes("HealthConnectPermissionDelegate")) {
      return config;
    }

    if (!contents.includes("import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate")) {
      contents = contents.replace(
        "import com.facebook.react.ReactActivity",
        "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate\nimport com.facebook.react.ReactActivity",
      );
    }

    if (!contents.includes("HealthConnectPermissionDelegate.setPermissionDelegate")) {
      const patched = contents.replace(
        /(super\.onCreate\([^)]*\)\s*\r?\n)/,
        "$1    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n",
      );
      if (patched === contents) {
        throw new Error(
          "[withHealthConnectMainActivity] Could not find `super.onCreate(...)` in MainActivity for Health Connect.",
        );
      }
      contents = patched;
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withHealthConnectMainActivity, "with-health-connect-main-activity", "1.0.1");
