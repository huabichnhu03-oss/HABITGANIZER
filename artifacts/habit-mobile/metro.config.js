const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const trackerI18n = path.resolve(projectRoot, "../habit-tracker/src/i18n");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), trackerI18n];

module.exports = config;
