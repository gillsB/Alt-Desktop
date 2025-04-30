import fs from "fs";
import { createLoggerForFile } from "./logging.js";
import { getSettingsFilePath } from "./util.js";

export const defaultSettings = {
  background: "",
  testKey: "testValue",
};

const logger = createLoggerForFile("settings.ts");

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
  }
};
