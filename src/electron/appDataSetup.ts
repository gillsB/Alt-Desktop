import fs from "fs";
import path from "path";
import { createLoggerForFile } from "./logging.js";
import { defaultSettings, ensureDefaultSettings } from "./settings.js";
import {
  ensureFileExists,
  getDataFolderPath,
  getDesktopIconsFilePath,
  getDesktopPath,
  getLogsFolderPath,
  getSettingsFilePath,
} from "./util.js";

const logger = createLoggerForFile("appDataSetup.ts");

/**
 * Retrieves the appData path for "AltDesktop" within the user's AppData/Roaming directory.
 *
 * @returns {string} The full path ..../AppData/Roaming/AltDesktop
 * @throws {Error} If the APPDATA environment variable is not in process.env.APPDATA
 *
 * @example
 * ```ts
 * try {
 *   const appDataPath = getAppDataPath();
 *   console.log(appDataPath); // Outputs: C:\Users\Username\AppData\Roaming\AltDesktop
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export const getAppDataPath = (): string => {
  const appDataPath = process.env.APPDATA;
  if (!appDataPath) {
    logger.error("APPDATA environment variable is not set.");
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
};

/**
 * Ensures that necessary AppData directories and files exist in .../AppData/Roaming/AltDesktop/
 *
 * @throws {Error} If there is an issue retrieving the AppData path or creating files/directories.
 *
 * @example
 * ```ts
 * ensureAppDataFiles();
 * ```
 */
export const ensureAppDataFiles = () => {
  try {
    const desktopPath = getDesktopPath();
    const dataFolderPath = getDataFolderPath();
    const logsFolderPath = getLogsFolderPath();
    const desktopIconsFilePath = getDesktopIconsFilePath();
    const settingsFilePath = getSettingsFilePath();

    // Ensure directories exist
    if (!fs.existsSync(desktopPath)) {
      logger.info("Directory does not exist, creating:", desktopPath);
      fs.mkdirSync(desktopPath, { recursive: true });
      logger.info("Directory created successfully.");
    } else {
      logger.info("Directory already exists:", desktopPath);
    }

    if (!fs.existsSync(dataFolderPath)) {
      logger.info("Data folder does not exist, creating:", dataFolderPath);
      fs.mkdirSync(dataFolderPath, { recursive: true });
      logger.info("Data folder created successfully.");
    } else {
      logger.info("Data folder already exists:", dataFolderPath);
    }
    if (!fs.existsSync(logsFolderPath)) {
      logger.info("Logs folder does not exist, creating:", logsFolderPath);
      fs.mkdirSync(logsFolderPath, { recursive: true });
      logger.info("Logs folder created successfully.");
    } else {
      logger.info("Logs folder already exists:", logsFolderPath);
    }

    // Ensure desktopIcons.json exists
    ensureFileExists(desktopIconsFilePath, { icons: [] });
    ensureFileExists(settingsFilePath, defaultSettings);
    ensureDefaultSettings();
  } catch (error) {
    logger.error("Error ensuring AppData files:", error);
  }
};
