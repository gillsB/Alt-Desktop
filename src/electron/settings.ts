import { app } from "electron";
import fs from "fs";
import { createLoggerForFile } from "./logging.js";
import { PUBLIC_TAG_CATEGORIES } from "./publicTags.js";
import { idToBgJsonPath } from "./utils/idToInfo.js";
import {
  backupSettingsFile,
  canReadWriteDir,
  getBackgroundsJsonFilePath,
  getSettingsFilePath,
} from "./utils/util.js";
import { showSmallWindow } from "./windows/subWindowManager.js";

export const defaultPublicCategories: Record<string, boolean> & {
  show: boolean;
} = {
  ...Object.fromEntries(PUBLIC_TAG_CATEGORIES.map((cat) => [cat.name, true])),
  show: true,
};

export const defaultSettings: SettingsData = {
  externalPaths: [],
  defaultIconSize: 64,
  defaultFontSize: 16,
  defaultFontColor: "#FFFFFF",
  windowType: "WINDOWED",
  defaultBackgroundPath: "",
  background: "",
  newBackgroundID: 1,
  bgSelectIconSize: "medium",
  publicCategories: defaultPublicCategories,
  localCategories: { show: true } as Record<string, boolean> & {
    show?: boolean;
  },
  localTags: [],
};

const logger = createLoggerForFile("settings.ts");

let pendingSettingsError: string | null = null;
let pendingSettingsNotice: string | null = null;

/**
 * Ensures that all default settings exist in the settings file.
 */
export const ensureDefaultSettings = (): void => {
  try {
    const settingsFilePath = getSettingsFilePath();
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));

    let updated = false;
    const addedKeys: string[] = [];
    let completelyRestored = false;

    const missingKeys = Object.keys(defaultSettings).filter(
      (key) => !(key in settings)
    );
    if (missingKeys.length === Object.keys(defaultSettings).length) {
      completelyRestored = true;
      logger.warn(
        "Settings file is missing all default keys. Completely restoring settings."
      );
    }

    // Check for missing keys in the settings file
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!(key in settings)) {
        logger.info(`Missing setting "${key}" detected. Adding default value.`);
        settings[key] = value;
        updated = true;
        addedKeys.push(key);
      }
    }

    // Migrate categories if needed
    if (migrateCategoriesSetting(settings)) {
      updated = true;
    }

    // Type check for all other settings (replace if type does not match default)
    for (const [key, defaultValue] of Object.entries(defaultSettings)) {
      const currentValue = settings[key];
      if (
        typeof currentValue !== typeof defaultValue ||
        (Array.isArray(defaultValue) && !Array.isArray(currentValue))
      ) {
        logger.info(
          `Setting "${key}" has invalid type. Replacing with default value.`
        );
        settings[key] = defaultValue;
        updated = true;
      }
    }

    // Write updated settings back to the file if changes were made
    if (updated) {
      // Backup before overwriting
      backupSettingsFile(settingsFilePath);

      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(settings, null, 2),
        "utf-8"
      );
      logger.info(
        "Settings file updated with missing or fixed default settings."
      );
      if (completelyRestored) {
        pendingSettingsError =
          "Your settings file was missing all default keys and has been completely rebuilt. If this was unplanned, a backup of your previous settings is saved as settings_old.json in User/AppData/Roaming/AltDesktop.";
      } else if (addedKeys.length > 1) {
        pendingSettingsNotice =
          "The following settings were restored or added:\n" +
          addedKeys.map((k) => `• ${k}`).join("\n") +
          "\nA backup of your previous settings is saved as settings_old.json in User/AppData/Roaming/AltDesktop.";
      }
    } else {
      logger.info(
        "No missing or invalid settings detected. Settings file is up-to-date."
      );
    }
  } catch (error) {
    logger.error("Error ensuring default settings:", error);

    pendingSettingsError = `Failed to load settings file. ${error}`;
  }
};

app.on("ready", () => {
  app.whenReady().then(async () => {
    if (pendingSettingsError) {
      logger.info("Attempting to show settings error window.");
      await showSmallWindow("Settings Error", pendingSettingsError, ["OK"]);
      pendingSettingsError = null; // Clear the error after showing the window
    }
    if (pendingSettingsNotice) {
      logger.info("Attempting to show settings notice window.");
      await showSmallWindow("Settings Notice", pendingSettingsNotice, ["OK"]);
      pendingSettingsNotice = null; // Clear the notice after showing the window
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

/**
 * Save partial settings data to the settings file.
 * Merges with current settings and writes to disk.
 */
export const saveSettingsData = async (
  data: Partial<SettingsData>
): Promise<boolean> => {
  try {
    // If externalPaths is being set, check all provided paths for read/write access
    if (data.externalPaths && Array.isArray(data.externalPaths)) {
      logger.info("Checking access for new external paths.");
      for (const extPath of data.externalPaths) {
        if (typeof extPath === "string" && extPath.length > 0) {
          const ok = await canReadWriteDir(extPath);
          if (!ok) {
            logger.error(`Aborting settings save: cannot access ${extPath}`);
            return false;
          }
          logger.info(`Access to external path verified: ${extPath}`);
        }
      }
    }
    const settingsFilePath = getSettingsFilePath();
    // Read current settings
    let currentSettings: SettingsData = defaultSettings;
    if (fs.existsSync(settingsFilePath)) {
      currentSettings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
    }
    // Merge only the provided keys/values
    const newSettings = { ...currentSettings, ...data };
    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify(newSettings, null, 2),
      "utf-8"
    );
    logger.info("Settings data saved successfully.");
    ensureDefaultSettings(); // Add back any missing default settings
    return true;
  } catch (error) {
    logger.error("Error saving settings data:", error);
    return false;
  }
};

export async function renameLocalTag(
  oldName: string,
  newName: string
): Promise<boolean> {
  try {
    if (!oldName || !newName || oldName === newName) {
      logger.warn("Invalid tag names for renaming.");
      return false;
    }

    // 1. Update localTags in settings.json
    let localTags = (getSetting("localTags") as LocalTag[]) ?? [];
    let tagsUpdated = false;
    localTags = localTags.map((tag) => {
      if (tag.name === oldName) {
        tagsUpdated = true;
        return { ...tag, name: newName };
      }
      return tag;
    });

    // 2. Update all bg.json files for backgrounds that reference the old tag name
    const backgroundsFilePath = getBackgroundsJsonFilePath();
    let backgroundsData: { backgrounds: Record<string, number> } = {
      backgrounds: {},
    };
    if (fs.existsSync(backgroundsFilePath)) {
      backgroundsData = JSON.parse(
        fs.readFileSync(backgroundsFilePath, "utf-8")
      );
    }
    const bgIds = Object.keys(backgroundsData.backgrounds);

    for (const id of bgIds) {
      const bgJsonPath = await idToBgJsonPath(id);
      if (fs.existsSync(bgJsonPath)) {
        const bgData = JSON.parse(fs.readFileSync(bgJsonPath, "utf-8"));
        // Update local tags if present
        if (
          bgData.local &&
          Array.isArray(bgData.local.tags) &&
          bgData.local.tags.includes(oldName)
        ) {
          bgData.local.tags = bgData.local.tags.map((tag: string) =>
            tag === oldName ? newName : tag
          );
          fs.writeFileSync(
            bgJsonPath,
            JSON.stringify(bgData, null, 2),
            "utf-8"
          );
          logger.info(
            `Renamed local tag in ${bgJsonPath}: ${oldName} -> ${newName}`
          );
        }
      }
    }

    // 3. Save updated localTags to settings
    if (tagsUpdated) {
      await saveSettingsData({ localTags });
      logger.info(
        `Renamed local tag "${oldName}" to "${newName}" in settings and backgrounds.`
      );
      return true;
    } else {
      await showSmallWindow(
        "Error Renaming Local Tag",
        `Failed to rename local tag from "${oldName}" to "${newName}".\nError: Tag not found.`,
        ["OK"]
      );
      logger.warn(`Tag "${oldName}" not found in localTags for renaming.`);
      return false;
    }
  } catch (e) {
    await showSmallWindow(
      "Error Renaming Local Tag",
      `Failed to rename local tag from "${oldName}" to "${newName}".\nError: ${e}`,
      ["OK"]
    );
    logger.error(
      `Error renaming local tag from "${oldName}" to "${newName}": ${e}`
    );
    return false;
  }
}

/**
 * Ensures all categories from localTags are present in the localCategories setting.
 * Adds any missing localCategories to the beginning of the localCategories array, saves, and returns the updated array.
 */
export async function getLocalCategories(): Promise<string[]> {
  try {
    // Get current categories and localTags from settings
    const categoriesObj =
      (getSetting("localCategories") as Record<string, boolean>) ?? {};
    const localTags = (getSetting("localTags") as LocalTag[]) ?? [];

    // Get all unique, non-empty categories from localTags
    const tagCategories = Array.from(
      new Set(
        localTags
          .map((tag) => tag.category)
          .filter((cat): cat is string => !!cat && typeof cat === "string")
      )
    );

    // Add missing categories to the categories object (default to true/expanded)
    let updated = false;
    for (const cat of tagCategories) {
      if (!(cat in categoriesObj)) {
        categoriesObj[cat] = true;
        updated = true;
      }
    }

    if (updated) {
      logger.info(
        `Adding missing categories: ${tagCategories.filter((cat) => !(cat in categoriesObj))}`
      );
      await saveSettingsData({ localCategories: categoriesObj });
    }

    return Object.keys(categoriesObj);
  } catch (error) {
    logger.error("Error syncing and getting categories:", error);
    return [];
  }
}

export async function addCategory(name: string, expanded = true) {
  try {
    if (!name) {
      return;
    }
    const categoriesObj =
      (getSetting("localCategories") as Record<string, boolean>) ?? {};
    if (!(name in categoriesObj)) {
      categoriesObj[name] = expanded;
      await saveSettingsData({ localCategories: categoriesObj });
      logger.info("Added category", name);
    } else {
      logger.info("Category already exists", name);
    }
  } catch (e) {
    logger.error(`Error adding category ${name}, ${e}`);
  }
}

export async function renameCategory(
  oldName: string,
  newName: string
): Promise<boolean> {
  try {
    if (!oldName || !newName || oldName === newName) {
      return false;
    }
    const categoriesObj =
      (getSetting("localCategories") as Record<string, boolean>) ?? {};
    let updated = false;

    if (oldName in categoriesObj) {
      const expanded = categoriesObj[oldName];
      delete categoriesObj[oldName];
      categoriesObj[newName] = expanded;
      updated = true;
    } else {
      logger.warn(`Category ${oldName} not found for renaming`);
    }

    // Update localTags with the new category name
    let localTags = (getSetting("localTags") as LocalTag[]) ?? [];
    let tagsUpdated = false;
    localTags = localTags.map((tag) => {
      if (tag.category === oldName) {
        tagsUpdated = true;
        return { ...tag, category: newName };
      }
      return tag;
    });

    if (updated || tagsUpdated) {
      await saveSettingsData({
        localCategories: categoriesObj,
        localTags,
      });
      logger.info(
        `Renamed category from ${oldName} to ${newName} and updated tags`
      );
      return true;
    }
  } catch (e) {
    logger.error(`Error renaming category from ${oldName} to ${newName}, ${e}`);
  }
  return false;
}

export async function deleteCategory(name: string): Promise<boolean> {
  try {
    if (!name) {
      return false;
    }
    // Remove from categories
    const categoriesObj =
      (getSetting("localCategories") as Record<string, boolean>) ?? {};
    if (!(name in categoriesObj)) {
      logger.warn(`Category ${name} not found for deletion`);
      return false;
    }
    delete categoriesObj[name];

    // Update localTags: set category to "" for tags with this category
    let localTags = (getSetting("localTags") as LocalTag[]) ?? [];
    localTags = localTags.map((tag) => {
      if (tag.category === name) {
        return { ...tag, category: "" };
      }
      return tag;
    });

    await saveSettingsData({
      localCategories: categoriesObj,
      localTags,
    });
    logger.info(`Deleted category "${name}" and reverted affected tags to ""`);
    return true;
  } catch (e) {
    logger.error(`Error deleting category ${name}: ${e}`);
    return false;
  }
}

/**
 * Migrates the categories setting to the correct object format if needed.
 * Returns true if migration occurred, false otherwise.
 */
function migrateCategoriesSetting(settings: Record<string, unknown>): boolean {
  let updated = false;

  // Step 1: Migrate from old "categories" key if present
  if ("categories" in settings) {
    logger.info("Found old 'categories' key. Beginning migration.");

    // If categories is an array, convert to object
    if (Array.isArray(settings.categories)) {
      logger.info("Migrating categories from array to object format.");
      const migrated: Record<string, boolean> & { show?: boolean } = {
        show: true,
      };
      for (const cat of settings.categories) {
        if (typeof cat === "string") {
          migrated[cat] = true;
        }
      }
      settings.localCategories = migrated;
      updated = true;
    }
    // Otherwise replace with default if it's not an object
    else if (
      typeof settings.categories !== "object" ||
      settings.categories === null ||
      Array.isArray(settings.categories)
    ) {
      logger.info("Replacing invalid categories setting with default.");
      settings.localCategories = { ...defaultSettings.localCategories };
      updated = true;
    }
    // If it is a valid object, move it directly
    else {
      settings.localCategories = { ...(settings.categories as object) };
      updated = true;
    }

    delete settings.categories; // Remove old key
  }

  // Step 2: Ensure "show" is present on localCategories
  if (
    typeof settings.localCategories === "object" &&
    settings.localCategories !== null &&
    !("show" in settings.localCategories)
  ) {
    (
      settings.localCategories as Record<string, boolean> & { show?: boolean }
    ).show = true;
    updated = true;
  }

  return updated;
}
