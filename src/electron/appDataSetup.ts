import fs from "fs";
import path from "path";
import { ensureFileExists } from "./util.js";

/** JSDoc
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
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
};

/** JSDoc
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
    const basePath = getAppDataPath();
    const desktopPath = path.join(basePath, "desktop");
    const dataFolderPath = path.join(basePath, "data");
    const desktopIconsFilePath = path.join(desktopPath, "desktopIcons.json");

    // Ensure directories exist
    if (!fs.existsSync(desktopPath)) {
      console.log("Directory does not exist, creating:", desktopPath);
      fs.mkdirSync(desktopPath, { recursive: true });
      console.log("Directory created successfully.");
    } else {
      console.log("Directory already exists:", desktopPath);
    }

    if (!fs.existsSync(dataFolderPath)) {
      console.log("Icons folder does not exist, creating:", dataFolderPath);
      fs.mkdirSync(dataFolderPath, { recursive: true });
      console.log("Icons folder created successfully.");
    } else {
      console.log("Icons folder already exists:", dataFolderPath);
    }

    // Ensure desktopIcons.json exists
    ensureFileExists(desktopIconsFilePath, { icons: [] });
  } catch (error) {
    console.error("Error ensuring AppData files:", error);
  }
};
