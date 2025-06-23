import { app } from "electron";
import fs from "fs";
import { createLoggerForFile } from "./logging.js";
import { getSettingsFilePath, saveExternalPaths } from "./utils/util.js";
import { openSmallWindow } from "./windows/subWindowManager.js";

export const defaultSettings: SettingsData = {
  background: "",
  defaultFontSize: 16,
  defaultIconSize: 64,
  defaultFontColor: "#FFFFFF",
  windowType: "WINDOWED",
  newBackgroundID: 1,
  externalPaths: [],
  categories: {} as Record<string, boolean>,
  localTags: [],
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

    // Migrate categories if needed
    if (migrateCategoriesSetting(settings)) {
      updated = true;
    }

    // Type check for all other settings (replace if type does not match default)
    for (const [key, defaultValue] of Object.entries(defaultSettings)) {
      if (key === "categories") continue; // already handled above
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
      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(settings, null, 2),
        "utf-8"
      );
      logger.info(
        "Settings file updated with missing or fixed default settings."
      );
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

/**
 * Save partial settings data to the settings file.
 * Merges with current settings and writes to disk.
 */
export const saveSettingsData = async (
  data: Partial<SettingsData>
): Promise<boolean> => {
  try {
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
    if (Array.isArray(data.externalPaths)) {
      await saveExternalPaths(data.externalPaths);
    }
    return true;
  } catch (error) {
    logger.error("Error saving settings data:", error);
    return false;
  }
};

/**
 * Ensures all categories from localTags are present in the categories setting.
 * Adds any missing categories to the beginning of the categories array, saves, and returns the updated array.
 */
export async function getCategories(): Promise<string[]> {
  try {
    // Get current categories and localTags from settings
    const categoriesObj =
      (getSetting("categories") as Record<string, boolean>) ?? {};
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
      await saveSettingsData({ categories: categoriesObj });
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
      (getSetting("categories") as Record<string, boolean>) ?? {};
    if (!(name in categoriesObj)) {
      categoriesObj[name] = expanded;
      await saveSettingsData({ categories: categoriesObj });
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
      (getSetting("categories") as Record<string, boolean>) ?? {};
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
        categories: categoriesObj,
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
      (getSetting("categories") as Record<string, boolean>) ?? {};
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
      categories: categoriesObj,
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
  // If categories is an array, convert to object
  if (Array.isArray(settings.categories)) {
    logger.info("Migrating categories from array to object format.");
    const migrated: Record<string, boolean> = {};
    for (const cat of settings.categories) {
      if (typeof cat === "string") {
        migrated[cat] = true;
      }
    }
    settings.categories = migrated;
    updated = true;
  }
  // Otherwise replace with default if its not an array.
  else if (
    typeof settings.categories !== "object" ||
    settings.categories === null ||
    Array.isArray(settings.categories)
  ) {
    logger.info("Replacing invalid categories setting with default.");
    settings.categories = { ...defaultSettings.categories };
    updated = true;
  }
  return updated;
}
