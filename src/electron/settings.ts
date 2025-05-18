import { app } from "electron";
import fs from "fs";
import { createLoggerForFile } from "./logging.js";
import { openSmallWindow } from "./subWindowManager.js";
import { getSettingsFilePath } from "./util.js";

export const defaultSettings = {
  videoBackground: "",
  imageBackground: "",
  defaultFontSize: 16,
  defaultIconSize: 64,
  defaultFontColor: "#FFFFFF",
};

const logger = createLoggerForFile("settings.ts");

let pendingSettingsError: string | null = null;

/**
 * Ensures that all default settings exist in the settings file.
 */
export const ensureDefaultSettings = (): void => {
  try {
    const settingsFilePath = getSettingsFilePath();
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));

    let updated = false;

    // Check for missing keys in the settings file
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!(key in settings)) {
        logger.info(`Missing setting "${key}" detected. Adding default value.`);
        settings[key] = value;
        updated = true;
      }
    }

    // Write updated settings back to the file if changes were made
    if (updated) {
      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(settings, null, 2),
        "utf-8"
      );
      logger.info("Settings file updated with missing default settings.");
    } else {
      logger.info("No missing settings detected. Settings file is up-to-date.");
    }
  } catch (error) {
    logger.error("Error ensuring default settings:", error);

    pendingSettingsError = `Failed to load settings file. ${error}`;
  }
};

app.on("ready", () => {
  app.whenReady().then(() => {
    if (pendingSettingsError) {
      logger.info("Attempting to show settings error window.");
      openSmallWindow("Settings Error", pendingSettingsError, ["OK"]);
      pendingSettingsError = null; // Clear the error after showing the window
    }
  });
});

export const getSetting = (key: keyof typeof defaultSettings): unknown => {
  try {
    const settingsFilePath = getSettingsFilePath();
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));

    if (key in settings) {
      return settings[key];
    } else if (key in defaultSettings) {
      return defaultSettings[key];
    } else {
      logger.error(
        `Setting "${key}" not found in settings or defaultSettings.`
      );
      return null;
    }
  } catch (error) {
    logger.error("Error retrieving setting:", error);
    return null;
  }
};
