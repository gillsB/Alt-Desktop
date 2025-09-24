import { shell } from "electron";
import fs from "fs";
import path from "path";
import { createLoggerForFile } from "./logging.js";
import { defaultSettings, ensureDefaultSettings } from "./settings.js";
import {
  ensureFileExists,
  getBackgroundFilePath,
  getBackgroundsJsonFilePath,
  getBasePath,
  getDefaultProfileJsonPath,
  getIconsFolderPath,
  getLogsFolderPath,
  getProfilesPath,
  getSettingsFilePath,
} from "./utils/util.js";

const logger = createLoggerForFile("appDataSetup.ts");

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
    const logsFolderPath = getLogsFolderPath();
    const settingsFilePath = getSettingsFilePath();
    const backgroundFilePath = getBackgroundFilePath();
    const backgroundsFilePath = getBackgroundsJsonFilePath();
    const profilesPath = getProfilesPath();
    const profilesDefaultFolder = path.join(profilesPath, "default");
    const defaultProfileJson = getDefaultProfileJsonPath();

    migrateLegacyDataFolders();

    // Ensure directories exist
    if (!fs.existsSync(logsFolderPath)) {
      logger.info("Logs folder does not exist, creating:", logsFolderPath);
      fs.mkdirSync(logsFolderPath, { recursive: true });
      logger.info("Logs folder created successfully.");
    } else {
      logger.info("Logs folder already exists:", logsFolderPath);
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
    ensureFileExists(backgroundsFilePath, {
      backgrounds: {},
    });
    ensureFileExists(settingsFilePath, defaultSettings);
    ensureFileExists(defaultProfileJson, { icons: [] });
    ensureDefaultSettings();
  } catch (error) {
    logger.error("Error ensuring AppData files:", error);
  }
};

async function migrateLegacyDataFolders() {
  const dataFolderPath = path.join(getBasePath(), "data");
  if (!fs.existsSync(dataFolderPath)) return;

  logger.info("Legacy data folder found, starting migration:", dataFolderPath);

  const dataIds = fs
    .readdirSync(dataFolderPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  logger.info(`Found ${dataIds.length} data folders:`, dataIds);

  const profilesPath = getProfilesPath();
  const profileFolders = fs
    .readdirSync(profilesPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  logger.info(
    `Found ${profileFolders.length} profile folders:`,
    profileFolders
  );

  let totalCopied = 0;
  const notFound: string[] = [];
  const copied: string[] = [];
  const successfullyCopiedDataIds = new Set<string>();
  const processedDataIds = new Set<string>(); // IDs that were found and processed (for deletion)

  for (const profileName of profileFolders) {
    logger.info(`Processing profile: ${profileName}`);

    const profileJsonPath = path.join(
      profilesPath,
      profileName,
      "profile.json"
    );

    if (!fs.existsSync(profileJsonPath)) {
      logger.warn(`profile.json not found for ${profileName}, skipping`);
      continue;
    }

    let profileData: { icons?: { id?: string }[] } = {};
    try {
      logger.info("Reading profile.json:", profileJsonPath);
      const fileContent = fs.readFileSync(profileJsonPath, "utf-8");
      profileData = JSON.parse(fileContent);
      logger.info(
        `Profile ${profileName} has ${profileData.icons?.length || 0} icons`
      );
    } catch (e) {
      logger.warn(`Failed to parse profile.json for ${profileName}:`, e);
      continue;
    }

    if (!profileData.icons || !Array.isArray(profileData.icons)) {
      logger.info(`Profile ${profileName} has no icons array, skipping`);
      continue;
    }

    const iconsFolder = getIconsFolderPath(profileName);
    if (!fs.existsSync(iconsFolder)) {
      fs.mkdirSync(iconsFolder, { recursive: true });
      logger.info(`Created icons folder: ${iconsFolder}`);
    }

    let profileCopied = 0;
    for (const icon of profileData.icons) {
      if (!icon || !icon.id) {
        logger.debug(`Skipping icon with no id in profile ${profileName}`);
        continue;
      }

      logger.debug(`Checking icon id: ${icon.id} for profile ${profileName}`);

      if (dataIds.includes(icon.id)) {
        processedDataIds.add(icon.id);

        const srcFolder = path.join(dataFolderPath, icon.id);
        const destFolder = path.join(iconsFolder, icon.id);

        try {
          // Ensure destination folder exists
          if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
            logger.info(`Created destination folder: ${destFolder}`);
          }

          const srcFiles = fs.readdirSync(srcFolder, { withFileTypes: true });
          let filesCopied = 0;

          for (const file of srcFiles) {
            const srcFilePath = path.join(srcFolder, file.name);
            const destFilePath = path.join(destFolder, file.name);

            if (!fs.existsSync(destFilePath)) {
              if (file.isDirectory()) {
                fs.cpSync(srcFilePath, destFilePath, { recursive: true });
                logger.debug(`Copied directory ${file.name} to ${destFolder}`);
                filesCopied++;
              } else {
                fs.copyFileSync(srcFilePath, destFilePath);
                logger.debug(`Copied file ${file.name} to ${destFolder}`);
                filesCopied++;
              }
            } else {
              logger.debug(
                `File ${file.name} already exists in ${destFolder}, skipping`
              );
            }
          }

          if (filesCopied > 0) {
            copied.push(`${icon.id} -> ${profileName} (${filesCopied} items)`);
            totalCopied += filesCopied;
            profileCopied++;
            successfullyCopiedDataIds.add(icon.id);
            logger.info(
              `Copied ${filesCopied} items from ${icon.id} to ${profileName}`
            );
          } else {
            logger.debug(
              `All files in ${icon.id} already exist in ${profileName}, nothing copied`
            );
            // Still mark as successfully copied since the data is already in place
            successfullyCopiedDataIds.add(icon.id);
          }
        } catch (e) {
          logger.error(`Failed to copy ${icon.id} to ${profileName}:`, e);
        }
      } else {
        logger.debug(`Icon id ${icon.id} not found in data folders`);
        notFound.push(icon.id);
      }
    }

    logger.info(`Profile ${profileName}: copied ${profileCopied} icons`);
  }

  // Find all dataIds not referenced by any profile
  const referencedIds = new Set<string>();
  for (const profileName of profileFolders) {
    const profileJsonPath = path.join(
      profilesPath,
      profileName,
      "profile.json"
    );
    if (!fs.existsSync(profileJsonPath)) continue;

    let profileData: { icons?: { id?: string }[] } = {};
    try {
      profileData = JSON.parse(fs.readFileSync(profileJsonPath, "utf-8"));
    } catch (e) {
      logger.error(`Failed to parse profile.json for ${profileName}:`, e);
      continue;
    }

    if (profileData.icons && Array.isArray(profileData.icons)) {
      for (const icon of profileData.icons) {
        if (icon && icon.id) {
          referencedIds.add(icon.id);
        }
      }
    }
  }

  const unreferencedDataIds = dataIds.filter((id) => !referencedIds.has(id));
  const uniqueNotFound = Array.from(new Set(notFound));

  logger.info(`Data migration complete. Total copied: ${totalCopied}.`);

  if (copied.length > 0) {
    logger.info(`Successfully copied: ${copied.join(", ")}`);
  }

  if (uniqueNotFound.length > 0) {
    logger.info(
      `IDs referenced by profiles but not found in /data/: ${uniqueNotFound.join(", ")}`
    );
  }

  if (unreferencedDataIds.length > 0) {
    logger.info(
      `IDs in /data/ not referenced by any profile: ${unreferencedDataIds.join(", ")}`
    );
  }

  // Move processed data folders to trash (both successfully copied and already existing)
  if (processedDataIds.size > 0) {
    logger.info(
      `Moving ${processedDataIds.size} processed data folders to trash...`
    );

    for (const dataId of processedDataIds) {
      const dataFolderToTrash = path.join(dataFolderPath, dataId);
      try {
        await shell.trashItem(dataFolderToTrash);
        logger.info(`Moved data folder to trash: ${dataId}`);
      } catch (e) {
        logger.error(`Failed to move data folder ${dataId} to trash:`, e);
      }
    }

    logger.info(
      `Cleanup complete. Moved ${processedDataIds.size} data folders to trash.`
    );

    // Log what is being kept
    const keptDataIds = dataIds.filter((id) => !processedDataIds.has(id));
    if (keptDataIds.length > 0) {
      logger.info(
        `Kept ${keptDataIds.length} unreferenced data folders: ${keptDataIds.join(", ")}`
      );
    }
  } else {
    logger.info(
      "No data folders were processed, so none will be moved to trash."
    );
  }
}
