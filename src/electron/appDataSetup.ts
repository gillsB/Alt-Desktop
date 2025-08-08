import fs from "fs";
import path from "path";
import { createLoggerForFile } from "./logging.js";
import { defaultSettings, ensureDefaultSettings } from "./settings.js";
import {
  ensureFileExists,
  getBackgroundFilePath,
  getBackgroundsJsonFilePath,
  getDataFolderPath,
  getDefaultProfilePath,
  getDesktopIconsFilePath,
  getLogsFolderPath,
  getProfilesPath,
  getSettingsFilePath,
} from "./utils/util.js";

const logger = createLoggerForFile("appDataSetup.ts");

const getDefaultProfile = (): DesktopIconData => {
  const filePath = getDesktopIconsFilePath();

  try {
    // Read JSON file
    const data = fs.readFileSync(filePath, "utf-8");
    logger.info(`Read file contents from ${filePath}`);
    const parsedData: DesktopIconData = JSON.parse(data);

    if (parsedData.icons) {
      parsedData.icons = parsedData.icons.map((icon) => {
        return icon;
      });
    }

    return parsedData;
  } catch (error) {
    logger.error(`Error reading or creating JSON file. ${error}`);
    return { icons: [] }; // Return default if error
  }
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
    const dataFolderPath = getDataFolderPath();
    const logsFolderPath = getLogsFolderPath();
    const desktopIconsFilePath = getDesktopIconsFilePath();
    const settingsFilePath = getSettingsFilePath();
    const backgroundFilePath = getBackgroundFilePath();
    const backgroundsFilePath = getBackgroundsJsonFilePath();
    const profilesPath = getProfilesPath();
    const profilesDefaultFolder = path.join(profilesPath, "default");
    const defaultProfileJson = getDefaultProfilePath();

    // Ensure directories exist
    if (!fs.existsSync(logsFolderPath)) {
      logger.info("Logs folder does not exist, creating:", logsFolderPath);
      fs.mkdirSync(logsFolderPath, { recursive: true });
      logger.info("Logs folder created successfully.");
    } else {
      logger.info("Logs folder already exists:", logsFolderPath);
    }
    if (!fs.existsSync(dataFolderPath)) {
      logger.info("Data folder does not exist, creating:", dataFolderPath);
      fs.mkdirSync(dataFolderPath, { recursive: true });
      logger.info("Data folder created successfully.");
    } else {
      logger.info("Data folder already exists:", dataFolderPath);
    }
    if (!fs.existsSync(backgroundFilePath)) {
      logger.info(
        "Background folder does not exist, creating:",
        backgroundFilePath
      );
      fs.mkdirSync(backgroundFilePath, { recursive: true });
      logger.info("Background folder created successfully.");
    } else {
      logger.info("Background folder already exists:", backgroundFilePath);
    }
    if (!fs.existsSync(profilesDefaultFolder)) {
      logger.info(
        "profiles folder does not exist, creating:",
        profilesDefaultFolder
      );
      fs.mkdirSync(profilesDefaultFolder, { recursive: true });
      logger.info("profiles folder created successfully.");
    } else {
      logger.info("profiles folder already exists:", profilesDefaultFolder);
    }

    // Ensure desktopIcons.json exists
    ensureFileExists(desktopIconsFilePath, { icons: [] });
    ensureFileExists(backgroundsFilePath, {
      backgrounds: {},
    });
    ensureFileExists(settingsFilePath, defaultSettings);
    ensureFileExists(defaultProfileJson, getDefaultProfile());
    ensureDefaultSettings();
  } catch (error) {
    logger.error("Error ensuring AppData files:", error);
  }
};
