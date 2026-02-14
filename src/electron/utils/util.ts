import {
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  WebContents,
  WebFrameMain,
} from "electron";
import fs from "fs";
import fsExtra from "fs-extra";
import mime from "mime-types";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { PUBLIC_TAG_CATEGORIES } from "../publicTags.js";
import { getSetting } from "../settings.js";
import {
  getAllowedUrls,
  showSmallWindow,
} from "../windows/subWindowManager.js";
import { generateIcon } from "./generateIcon.js";
import { idToBgJsonPath } from "./idToInfo.js";
import { getRendererState, getRendererStates } from "./rendererStates.js";

const logger = createLoggerForFile("util.ts");

const PUBLIC_TAGS_FLAT = PUBLIC_TAG_CATEGORIES.flatMap((cat) => cat.tags);

let isSubWindowDevtoolsEnabled = false;
let isSmallWindowDevtoolsEnabled = false;

let mainWindow: BrowserWindow | null = null;

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export function setSubWindowDevtoolsEnabled(enabled: boolean): void {
  isSubWindowDevtoolsEnabled = enabled;
}
export function subWindowDevtoolsEnabled(): boolean {
  return isSubWindowDevtoolsEnabled;
}

export function setSmallWindowDevtoolsEnabled(enabled: boolean): void {
  isSmallWindowDevtoolsEnabled = enabled;
}
export function smallWindowDevtoolsEnabled(): boolean {
  return isSmallWindowDevtoolsEnabled;
}

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Retrieves the appData path for "AltDesktop" within the user's AppData/Roaming directory.
 *
 * @returns {string} The full path ..../AppData/Roaming/AltDesktop
 * @throws {Error} If the APPDATA environment variable is not in process.env.APPDATA
 *
 */
export const getAppDataPath = (): string => {
  const appDataPath = process.env.APPDATA;
  if (!appDataPath) {
    logger.error("APPDATA environment variable is not set.");
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
};

export const getBasePath = (): string => {
  return getAppDataPath();
};

export const getIconsFolderPath = (profile: string): string => {
  if (!profile) {
    profile = "default";
  }
  const profilesPath = getProfilesPath();
  const profilePath = path.join(profilesPath, profile);
  return path.join(profilePath, "icons");
};

export const getLogsFolderPath = (): string => {
  return path.join(getBasePath(), "logs");
};

export const getSettingsFilePath = (): string => {
  return path.join(getBasePath(), "settings.json");
};

export const getBackgroundFilePath = (): string => {
  const bgPath = getSetting("defaultBackgroundPath") as string;
  if (bgPath) {
    return bgPath;
  } else {
    return path.join(getBasePath(), "backgrounds");
  }
};

export const getBackgroundsJsonFilePath = (): string => {
  return path.join(getBasePath(), "backgrounds.json");
};

export const getProfilesPath = (): string => {
  return path.join(getBasePath(), "profiles");
};
export const getDefaultProfileJsonPath = (): string => {
  const defaultFolder = path.join(getProfilesPath(), "default");
  return path.join(defaultFolder, "profile.json");
};

export const getProfileJsonPath = (profileName: string): string => {
  const profileFolder = path.join(getProfilesPath(), profileName);
  return path.join(profileFolder, "profile.json");
};

interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
}

/**
 * Registers an IPC event handler for the specified key.
 *
 * This function wraps `ipcMain.handle` to enforce validation and support both synchronous
 * and asynchronous handlers and parameters.
 *
 * @template Key - The key representing the IPC event type, mapped to a specific payload in `EventPayloadMapping`.
 * @template Args - The argument types for the handler function (default is an empty array).
 *
 * @param {Key} key - The IPC event key.
 * @param {function(...Args): EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>} handler
 * - The handler function that processes the event and returns a response.
 *
 * @throws {Error} If the event sender frame is null. Or from an unknown non-validated source.
 * If the handler throws, the error is logged and displayed in a small window.
 *
 * @example
 * ```ts
 * ipcMainHandle("getSettings", async () => {
 *   return await loadSettings();
 * });
 * ```
 */
export function ipcMainHandle<
  Key extends keyof EventPayloadMapping,
  Args extends unknown[] = [],
>(
  key: Key,
  handler: (
    ...args: Args
  ) => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>
) {
  ipcMain.handle(key, async (event, ...args: Args) => {
    try {
      if (!event.senderFrame) {
        throw new Error("Event sender frame is null");
      }
      validateEventFrame(event.senderFrame);

      const result = await handler(...args);
      return result;
    } catch (error) {
      // Format error details in a readable way
      const errorDetails: ErrorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              name: "UnknownError",
              message: String(error),
              stack: undefined,
            };

      const formattedError = [
        `IPC Handler Error [${key}]:`,
        `  Channel: ${key}`,
        `  Arguments: ${JSON.stringify(args, null, 2)}`,
        `  Error Name: ${errorDetails.name}`,
        `  Error Message: ${errorDetails.message}`,
        errorDetails.stack ? `  Stack Trace:\n${errorDetails.stack}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // Log the formatted error
      logger.error(formattedError);

      showSmallWindow("IPC Handler Error", formattedError, ["OK"]);

      throw error;
    }
  });
}

/**
 * Registers an IPC event listener for the specified key.
 *
 * This function processes events sent from the renderer process without expecting a response.
 *
 * @template Key - A key of `EventPayloadMapping`, representing the IPC event name.
 * @param {Key} key - The event name to listen for.
 * @param {(payload: EventPayloadMapping[Key]) => void} handler - The function to handle the event payload.
 *
 * @throws {Error} If the event sender frame is null.
 *
 * @example
 * ipcMainOn("sendHeaderAction", (payload) => {
 *   if (payload === "MINIMIZE") {
 *     mainWindow.minimize();
 *   }});
 */
export function ipcMainOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (payload: EventPayloadMapping[Key]) => void
) {
  ipcMain.on(key, (event, payload) => {
    if (!event.senderFrame) {
      throw new Error("Event sender frame is null");
    }
    validateEventFrame(event.senderFrame);
    return handler(payload);
  });
}

/**
 * Sends an IPC message from the main process to the renderer process.
 *
 * This function sends an event with a payload to a specific WebContents instance,
 *
 * @template Key - A key from `EventPayloadMapping`, representing the IPC event name.
 * @param {Key} key - The event name to send.
 * @param {WebContents} webContents - The WebContents instance (renderer process) to send the event to.
 * @param {EventPayloadMapping[Key]} payload - The data (payload) to send with the event.
 *
 * @example
 *  ipcWebContentsSend("statistics", mainWindow.webContents, {
 *    cpuUsage,
 *    ramUsage,
 *    storageUsage: storageData.usage,
 *  });
 */
export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key]
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain) {
  const allowedUrls = getAllowedUrls();

  if (!allowedUrls.some((url) => frame.url.startsWith(url))) {
    logger.error(
      `Malicious event from unknown source: ${frame.url} Allowed URLs: ${JSON.stringify(allowedUrls)}`
    );
    throw new Error("Malicious event");
  }
}

export const ensureFileExists = (
  filePath: string,
  defaultData: object
): boolean => {
  try {
    if (!fs.existsSync(filePath)) {
      /** All files should be created properly in other functions before this check is called
       *  We should not rely on this as a go-to for creating files.
       *  So display an error when filepath does not exist to identify how/when this is called
       *  before a file is created.
       */
      logger.warn(
        "Warning: file does not exist, When it should, fallback creating:",
        filePath
      );
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
      logger.info("File created successfully.");
    }
    return true;
  } catch (error) {
    logger.error("Failed to create file:", filePath, error);
    return false;
  }
};

/**
 * Resolves a Windows shortcut (.lnk) to its actual target path.
 * @param filePath The path to the .lnk file
 * @returns The resolved target path or the original path if not a shortcut
 */
export function resolveShortcut(filePath: string): string {
  if (process.platform === "win32" && filePath.endsWith(".lnk")) {
    try {
      const shortcut = shell.readShortcutLink(filePath);
      return shortcut.target;
    } catch (error) {
      console.error("Failed to resolve shortcut:", error);
      return filePath; // Fall back to original path if resolution fails
    }
  }
  return filePath;
}

/**
 * Resets the fontColor of all icons in desktopIcons.json to an empty string.
 * Returns true if successful, false otherwise.
 */
export async function resetAllIconsFontColor(): Promise<boolean> {
  try {
    const filePath = await getSelectedProfilePath();
    if (!fs.existsSync(filePath)) {
      logger.warn(`desktopIcons.json does not exist at: ${filePath}`);
      return false;
    }
    const data = fs.readFileSync(filePath, "utf-8");
    const desktopData: DesktopIconData = JSON.parse(data);

    if (Array.isArray(desktopData.icons)) {
      desktopData.icons = desktopData.icons.map((icon) => ({
        ...icon,
        fontColor: "",
      }));
      fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2), "utf-8");
      logger.info("All icon fontColor values reset to empty string.");
      return true;
    } else {
      logger.warn("No icons array found in desktopIcons.json.");
      return false;
    }
  } catch (error) {
    logger.error("Failed to reset all icon fontColor values:", error);
    return false;
  }
}

/**
 * Updates the resizability of the main window based on the header type.
 * Only false if the header type is "BORDERLESS" and the window is maximized. Otherwise, True.
 * @param mainWindow The main window of the application.
 */
export const updateHeader = async (mainWindow: BrowserWindow) => {
  const windowType = await getSetting("windowType");
  if (windowType === "BORDERLESS" && mainWindow.isMaximized()) {
    mainWindow.setResizable(false);
  } else {
    mainWindow.setResizable(true);
  }
};

/**
 * Escapes special characters in a string for use in a regular expression.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getTagIndex(): Promise<Record<string, string[]>> {
  const backgroundsJsonPath = getBackgroundsJsonFilePath();
  const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
  const data = JSON.parse(raw);
  return data.tags || {};
}

export async function getNameIndex(): Promise<Record<string, string[]>> {
  const backgroundsJsonPath = getBackgroundsJsonFilePath();
  const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
  const data = JSON.parse(raw);
  return data.names || {};
}

/**
 * Indexes all background folders in the AppData/Roaming/AltDesktop/backgrounds directory.
 * It reads the directory, checks for subfolders containing a bg.json file, if found adds them to backgrounds.json.
 */
export async function indexBackgrounds(options?: {
  newExternalPathAdded?: boolean;
  newDefaultPathAdded?: boolean;
}) {
  const backgroundsDir = getBackgroundFilePath();
  const backgroundsJsonPath = getBackgroundsJsonFilePath();

  // Get the default backgrounds folder path
  const appDataBackgroundsDir = path.join(getBasePath(), "backgrounds");
  const hasCustomPath = getSetting("defaultBackgroundPath") as string;

  // Read all entries in the main backgrounds directory
  const entries = await fs.promises.readdir(backgroundsDir, {
    withFileTypes: true,
  });

  // Find subfolders with a bg.json file in the main backgrounds directory
  const subfoldersWithBgJson: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subfolderPath = path.join(backgroundsDir, entry.name);
      const bgJsonPath = path.join(subfolderPath, "bg.json");
      if (fs.existsSync(bgJsonPath)) {
        subfoldersWithBgJson.push(entry.name);
      }
    }
  }

  // If user has a custom path, also index the default AppData /backgrounds/ folder
  if (hasCustomPath && fs.existsSync(appDataBackgroundsDir)) {
    try {
      const defaultEntries = await fs.promises.readdir(appDataBackgroundsDir, {
        withFileTypes: true,
      });

      for (const entry of defaultEntries) {
        if (entry.isDirectory()) {
          const subfolderPath = path.join(appDataBackgroundsDir, entry.name);
          const bgJsonPath = path.join(subfolderPath, "bg.json");
          if (fs.existsSync(bgJsonPath)) {
            // Use a prefix to distinguish default folder backgrounds
            subfoldersWithBgJson.push(`default::${entry.name}`);
          }
        }
      }
    } catch (e) {
      logger.warn(
        `Failed to index default backgrounds in ${appDataBackgroundsDir}:`,
        e
      );
    }
  }

  // Load External Paths from settings.json
  let externalPaths: string[] = [];
  try {
    const settingsExternalPaths = await getSetting("externalPaths");
    if (Array.isArray(settingsExternalPaths)) {
      externalPaths = settingsExternalPaths.filter(
        (p: string) => typeof p === "string"
      );
    }
  } catch (e) {
    logger.warn("Failed to read externalPaths from settings.json:", e);
  }

  // index external paths backgrounds
  for (let i = 0; i < externalPaths.length; i++) {
    const extBase = externalPaths[i];
    if (!extBase || !fs.existsSync(extBase)) continue;

    try {
      const extEntries = await fs.promises.readdir(extBase, {
        withFileTypes: true,
      });

      for (const entry of extEntries) {
        if (entry.isDirectory()) {
          const subfolderPath = path.join(extBase, entry.name);
          const bgJsonPath = path.join(subfolderPath, "bg.json");
          if (fs.existsSync(bgJsonPath)) {
            subfoldersWithBgJson.push(`ext::${i}::${entry.name}`);
          }
        }
      }
    } catch (e) {
      logger.warn(`Failed to index external backgrounds in ${extBase}:`, e);
    }
  }

  const validIds = new Set(subfoldersWithBgJson);

  // Check if backgrounds.json exists
  if (!fs.existsSync(backgroundsJsonPath)) {
    const errorMsg =
      `backgrounds.json does not exist at: ${backgroundsJsonPath}` +
      "Restore backgrounds.json or restart program to build backgrounds.json";
    logger.error(errorMsg);
    await showSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
    throw new Error(errorMsg);
  }

  // Read and validate backgrounds.json
  let backgroundsData: BackgroundsData;
  const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
  try {
    backgroundsData = JSON.parse(raw);
    if (
      typeof backgroundsData.backgrounds !== "object" ||
      backgroundsData.backgrounds === null
    ) {
      const errorMsg = `"backgrounds" object missing or invalid in backgrounds.json`;
      logger.error(errorMsg);
      await showSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
      throw new Error(errorMsg);
    }
  } catch (e) {
    const errorMsg = `Failed to parse backgrounds.json: ${e}`;
    logger.error(errorMsg);
    await showSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
    throw new Error(errorMsg);
  }

  // Add new backgrounds if not already present
  let updated = false;
  let foundUnindexedBgJson = false;
  let importWithSavedDate = false; // Default to "Import as New"

  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      foundUnindexedBgJson = true;
    }
  }

  // Only prompt if unindexed bg.jsons found and newExternalPathAdded or newDefaultPathAdded is true
  if (
    foundUnindexedBgJson &&
    (options?.newExternalPathAdded || options?.newDefaultPathAdded)
  ) {
    const source =
      options?.newExternalPathAdded && options?.newDefaultPathAdded
        ? "external or default"
        : options?.newExternalPathAdded
          ? "external"
          : "default";
    const choice = await showSmallWindow(
      "Import Backgrounds",
      `Existing bg.json files found in ${source} path(s) that are not indexed. \nHow would you like to import them?`,
      ["Import as New (Appear first)", "Import with Saved Date"],
      false
    );
    // Defaults to Import as New, only true if user explicitly chooses "Import with Saved Date"
    // If user somehow closes smallWindow without choosing, it indexes as new.
    importWithSavedDate = choice === "Import with Saved Date";
  }

  const newIds: string[] = [];
  const newBgIndexedTimes: Record<string, number> = {};
  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      newIds.push(folderName);
      let indexedTime: number | undefined = Math.floor(Date.now() / 1000);
      const bgJsonPath = await idToBgJsonPath(folderName);
      if (fs.existsSync(bgJsonPath)) {
        try {
          const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
          const bg: BgJson = JSON.parse(rawBg);

          if (
            importWithSavedDate &&
            bg.local &&
            bg.local.indexed &&
            !isNaN(bg.local.indexed)
          ) {
            // Use saved date from bg.json if user chose "Import with Saved Date"
            indexedTime = Number(bg.local.indexed);
          }
        } catch (e) {
          logger.warn(
            `Could not read indexed value from ${bgJsonPath}, using current time. error: ${e}`
          );
        }
      }
      // In case saved time in bg.json is not valid or not found
      if (indexedTime === undefined) {
        indexedTime = Math.floor(Date.now() / 1000);
      }
      newBgIndexedTimes[folderName] = indexedTime;
    }
  }

  // Remove non-existent backgrounds
  const removedIds: { id: string; value: number }[] = [];
  for (const id of Object.keys(backgroundsData.backgrounds)) {
    if (!validIds.has(id)) {
      logger.info(`Removing non-existent background: ${id}`);
      removedIds.push({ id, value: backgroundsData.backgrounds[id] });
      delete backgroundsData.backgrounds[id];
      updated = true;
    }
  }

  // Build a map for quick lookup
  const removedIdMap = new Map<string, number>();
  for (const { id, value } of removedIds) {
    removedIdMap.set(id, value);
  }

  // Find suspected moves (For keeping indexed time sorted order)
  const suspectedMoves = new Set<string>();
  for (const newId of newIds) {
    let matchedRemovedId: string | null = null;
    let indexedTime: number = Math.floor(Date.now() / 1000);
    let foundValidIndexed = false;

    // 1. Exact match
    if (removedIdMap.has(newId)) {
      matchedRemovedId = newId;
    } else {
      // 2. Fallback: base name match
      let newBaseId = newId;
      const newExtMatch = newId.match(/^ext::\d+::(.+)$/);
      if (newExtMatch) {
        newBaseId = newExtMatch[1];
      }
      // Also handle default:: prefix
      const newDefaultMatch = newId.match(/^default::(.+)$/);
      if (newDefaultMatch) {
        newBaseId = newDefaultMatch[1];
      }
      newBaseId = newBaseId.replace(/_\d+$/, "");

      for (const removedId of removedIdMap.keys()) {
        let baseId = removedId;
        const extMatch = removedId.match(/^ext::\d+::(.+)$/);
        if (extMatch) {
          baseId = extMatch[1];
        }
        const defaultMatch = removedId.match(/^default::(.+)$/);
        if (defaultMatch) {
          baseId = defaultMatch[1];
        }
        baseId = baseId.replace(/_\d+$/, "");
        if (baseId === newBaseId) {
          matchedRemovedId = removedId;
          break;
        }
      }
    }

    if (matchedRemovedId) {
      logger.info(`suspected move from ${matchedRemovedId} to ${newId}`);

      // Try to fetch local.indexed from newId's bg.json
      try {
        const newBgJsonPath = await idToBgJsonPath(newId);
        if (fs.existsSync(newBgJsonPath)) {
          const rawBg = await fs.promises.readFile(newBgJsonPath, "utf-8");
          const bg: BgJson = JSON.parse(rawBg);
          if (
            bg.local &&
            typeof bg.local.indexed === "number" &&
            !isNaN(bg.local.indexed)
          ) {
            indexedTime = bg.local.indexed;
            foundValidIndexed = true;
          }
        }
      } catch (e) {
        logger.warn(
          `Could not read local.indexed from bg.json for ${newId}:`,
          e
        );
      }
      backgroundsData.backgrounds[newId] = indexedTime;
      if (!foundValidIndexed) {
        await saveBgJsonFile({
          id: newId,
          localIndexed: indexedTime,
        });
      }
      logger.info(
        `Suspected move from ${matchedRemovedId} to ${newId}. Set indexed time of ${newId} to ${indexedTime}`
      );
      updated = true;
      suspectedMoves.add(newId);
    }
  }

  for (const newId of newIds) {
    if (!suspectedMoves.has(newId)) {
      backgroundsData.backgrounds[newId] = newBgIndexedTimes[newId];
      await saveBgJsonFile({
        id: newId,
        localIndexed: newBgIndexedTimes[newId],
      });
      updated = true;
    }
  }

  // Build tag and name indexes
  const tagsIndex: Record<string, Set<string>> = {};
  const namesIndex: Record<string, Set<string>> = {};

  const localTags = await getSetting("localTags");

  const allowedTags = [
    ...PUBLIC_TAGS_FLAT.map((tag) => tag.toLowerCase()),
    ...(Array.isArray(localTags) ? localTags.map((tag) => tag.name) : []),
  ];

  logger.info("Allowed tags for indexing:", allowedTags);

  const ids = Object.keys(backgroundsData.backgrounds);
  await promisePool(ids, 50, async (id) => {
    const bgJsonPath = await idToBgJsonPath(id);
    try {
      if (fs.existsSync(bgJsonPath)) {
        const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
        const bg: BgJson = JSON.parse(rawBg);

        // Index tags
        if (bg.public?.tags && Array.isArray(bg.public.tags)) {
          for (const tag of bg.public.tags) {
            const tagLower = tag.toLowerCase();
            if (allowedTags.includes(tagLower)) {
              if (!tagsIndex[tagLower]) tagsIndex[tagLower] = new Set();
              tagsIndex[tagLower].add(id);
            }
          }
        }
        // Index local tags
        if (bg.local?.tags && Array.isArray(bg.local.tags)) {
          for (const tag of bg.local.tags) {
            const tagLower = tag.toLowerCase();
            if (allowedTags.includes(tagLower)) {
              if (!tagsIndex[tagLower]) tagsIndex[tagLower] = new Set();
              tagsIndex[tagLower].add(id);
            }
          }
        }

        // Index names
        if (bg.public?.name) {
          const name = bg.public.name;
          if (!namesIndex[name]) namesIndex[name] = new Set();
          namesIndex[name].add(id);
        }
      } else {
        logger.error(
          `bg.json does not exist at ${bgJsonPath} Cannot load ${id} into backgrounds.json`
        );
      }
    } catch (e) {
      logger.warn(`Failed to index tags/names for ${id}:`, e);
    }
  });

  // Convert sets to arrays for JSON serialization
  backgroundsData.tags = {};
  for (const tag in tagsIndex) {
    if (allowedTags.includes(tag)) {
      backgroundsData.tags[tag] = Array.from(tagsIndex[tag]);
    }
  }
  backgroundsData.names = {};
  for (const name in namesIndex) {
    backgroundsData.names[name] = Array.from(namesIndex[name]);
  }

  if (
    updated ||
    JSON.stringify(backgroundsData.tags) !==
      JSON.stringify(JSON.parse(raw).tags || {}) ||
    JSON.stringify(backgroundsData.names) !==
      JSON.stringify(JSON.parse(raw).names || {})
  ) {
    await fs.promises.writeFile(
      backgroundsJsonPath,
      JSON.stringify(backgroundsData, null, 2),
      "utf-8"
    );
    logger.info(
      "updated backgrounds.json with new backgrounds, tags, and names."
    );
  }
  const allWindows = BrowserWindow.getAllWindows();
  const mainWindow =
    allWindows.find(
      (activeSubWindow) => activeSubWindow.title === "AltDesktop"
    ) || (allWindows.length > 0 ? allWindows[0] : null);
  mainWindow?.webContents.send("backgrounds-updated");
  logger.info(
    `Indexed ${newIds.length} new background(s), removed ${removedIds.length} background(s).`
  );
  logger.info("Finished indexing");
  return [newIds.length, removedIds.length] as [number, number];
}

export async function getBgJsonFile(id: string): Promise<BgJson | null> {
  try {
    if (!id) {
      logger.info("No id set for getBgJsonFile, returning null");
      return null;
    }

    const bgJsonPath = await idToBgJsonPath(id);

    // Check if the file exists
    if (!fs.existsSync(bgJsonPath)) {
      logger.warn(`Background file for id ${id} not found.`);
      return null;
    }

    // Read and parse the existing bg.json
    const rawBgJson = await fs.promises.readFile(bgJsonPath, "utf-8");
    const bgJson: BgJson = JSON.parse(rawBgJson);

    return bgJson;
  } catch (error) {
    showSmallWindow(
      "Failed to get bg.json",
      `Failed to get bg.json: ${error}`,
      ["OK"]
    );
    logger.error("Failed to get bg.json:", error);
    return null;
  }
}
/**
 * Saves a bg.json file for a background summary.
 * Accepts full or partial summary and only updates the provided fields, leaving others unchanged.
 * @param summary The full/partial background summary to save.
 */
export async function saveBgJsonFile(
  summary: Partial<BackgroundSummary>
): Promise<boolean> {
  try {
    if (!summary.id) throw new Error("Missing background id");
    logger.info("Saving bgJson with summary = ", JSON.stringify(summary));
    const bgJsonPath = await idToBgJsonPath(summary.id);

    // Ensure the directory exists
    await fs.promises.mkdir(path.dirname(bgJsonPath), { recursive: true });

    // Read existing bg.json if it exists
    let oldBg: BgJson = {};
    if (fs.existsSync(bgJsonPath)) {
      try {
        const rawOld = await fs.promises.readFile(bgJsonPath, "utf-8");
        oldBg = JSON.parse(rawOld);
      } catch (e) {
        logger.info(
          `Failed to read existing bg.json for ${summary.id}, will use defaults. error: ${e}`
        );
        return false;
      }
    }

    // Merge fields: use provided summary fields, otherwise fall back to oldBg, then default
    const publicData = {
      name:
        summary.name !== undefined ? summary.name : (oldBg.public?.name ?? ""),
      bgFile:
        summary.bgFile !== undefined
          ? summary.bgFile
          : (oldBg.public?.bgFile ?? ""),
      icon:
        summary.iconPath !== undefined
          ? summary.iconPath
            ? path.basename(summary.iconPath)
            : ""
          : (oldBg.public?.icon ?? ""),
      description:
        summary.description !== undefined
          ? summary.description
          : (oldBg.public?.description ?? ""),
      tags:
        summary.tags !== undefined ? summary.tags : (oldBg.public?.tags ?? []),
    };

    // Handle local.indexed logic
    const indexed: number | undefined =
      summary.localIndexed !== undefined
        ? summary.localIndexed
        : (oldBg.local?.indexed ?? Math.floor(Date.now() / 1000));

    const localData = {
      profile:
        summary.localProfile !== undefined
          ? summary.localProfile
          : (oldBg.local?.profile ?? "default"),
      volume:
        summary.localVolume !== undefined
          ? summary.localVolume
          : (oldBg.local?.volume ?? 0.5),
      tags:
        summary.localTags !== undefined
          ? summary.localTags
          : (oldBg.local?.tags ?? []),
      indexed,
    };

    // Write merged bg.json
    const bgJson = {
      public: publicData,
      local: localData,
    };

    logger.info("saving bg.json");
    await fs.promises.writeFile(
      bgJsonPath,
      JSON.stringify(bgJson, null, 2),
      "utf-8"
    );
    return true;
  } catch (error) {
    logger.error("Failed to save bg.json:", error);
    return false;
  }
}

/**
 * Helper to get an external path from settings.json
 */
export async function getExternalPath(index: number) {
  try {
    const externalPaths = await getSetting("externalPaths");
    if (Array.isArray(externalPaths) && externalPaths[index]) {
      return externalPaths[index];
    }
  } catch (e) {
    logger.warn("Failed to get externalPath from settings.json:", e);
  }
  return null;
}

export async function filterBackgroundEntries(
  entries: [string, number][],
  search: string,
  includeTags: string[] = [],
  excludeTags: string[] = []
): Promise<[string, number][]> {
  const [tagIndex, nameIndex] = await Promise.all([
    getTagIndex(),
    getNameIndex(),
  ]);

  // TagIndex uses lowercase, so convert to lowercase.
  const excludeTagsLower = excludeTags.map((tag) => tag.toLowerCase());
  const includeTagsLower = includeTags.map((tag) => tag.toLowerCase());

  // Build a set of all ids to exclude
  const excludedIds = new Set<string>();
  if (excludeTagsLower.length > 0) {
    excludeTagsLower.forEach((tag) => {
      (tagIndex[tag] || []).forEach((id) => excludedIds.add(id));
    });
  }

  // Operator-based search
  const op = parseSearchQuery(search);
  if (op) {
    let matchedIds: string[] = [];
    if (op.type === "id") {
      matchedIds = entries.filter(([id]) => id === op.value).map(([id]) => id);
    } else if (op.type === "name") {
      matchedIds = Object.entries(nameIndex)
        .filter(([name]) => name.toLowerCase() === op.value.toLowerCase())
        .flatMap(([, ids]) => ids)
        .filter((id) => entries.some(([eid]) => eid === id));
    } else if (op.type === "tag") {
      const tag = op.value.toLowerCase();
      matchedIds = (tagIndex[tag] || []).filter((id) =>
        entries.some(([eid]) => eid === id)
      );
    }
    const matchedSet = new Set(matchedIds);
    entries = entries.filter(([id]) => matchedSet.has(id));
    // Still apply include/exclude tags
    return entries.filter(([id]) => {
      if (excludedIds.has(id)) return false;
      if (includeTagsLower.length > 0) {
        // AND logic: id must be present in every tag's id list
        const hasAllTags = includeTagsLower.every((tag) =>
          (tagIndex[tag] || []).includes(id)
        );
        if (!hasAllTags) return false;
      }
      return true;
    });
  }

  // Handle includeTags with AND logic (must have ALL tags)
  return entries.filter(([id]) => {
    // Exclude: remove if in excludedIds
    if (excludedIds.has(id)) return false;

    // Include: must have ALL includeTags
    if (includeTagsLower.length > 0) {
      const hasAllTags = includeTagsLower.every((tag) =>
        (tagIndex[tag] || []).includes(id)
      );
      if (!hasAllTags) return false;
    }
    // If no search term, return true (already passed include/exclude filters)
    if (!search) return true;

    const searchLower = search.toLowerCase();
    const idMatch = id.toLowerCase().includes(searchLower);

    // Tag and name partial match
    const tagMatch = Object.keys(tagIndex).some(
      (tag) =>
        tag.toLowerCase().includes(searchLower) &&
        (tagIndex[tag] || []).includes(id)
    );
    const nameMatch = Object.keys(nameIndex).some(
      (name) =>
        name.toLowerCase().includes(searchLower) &&
        (nameIndex[name] || []).includes(id)
    );

    return idMatch || tagMatch || nameMatch;
  });
}

export const parseSearchQuery = (search: string) => {
  const match = search.match(/^(id|name|tag):(.+)$/i);
  if (match) {
    return { type: match[1].toLowerCase(), value: match[2] };
  }
  return null;
};

// Helper: concurrency-limited promise pool
export async function promisePool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
) {
  const queue = [...items]; // Clone the input

  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      try {
        await fn(item);
      } catch (err) {
        logger.warn("Error processing item in promisePool: " + `${item}`, err);
      }
    }
  });

  await Promise.all(workers);
}

/**
 * Backs up the given file to file_old.json in the same directory, if not already present.
 * Returns true if backup was made, false if already exists or failed.
 */
export function backupSettingsFile(settingsPath: string): boolean {
  try {
    const dir = path.dirname(settingsPath);
    const backupPath = path.join(dir, "settings_old.json");
    if (!fs.existsSync(backupPath) && fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
      return true;
    }
  } catch (e) {
    logger.error("Failed to backup settings file:", e);
    return false;
  }
  return false;
}

/**
 * Moves a background folder (and its bg.json) from its current location to a new directory.
 * @param id The background ID (may be ext::<index>::<baseId> or just <baseId> (for default location))
 * @param targetLocation "default" or "external:<index>" (e.g., "external:0")
 * @returns The new ID if successful, or null if failed.
 */
export async function changeBackgroundDirectory(
  id: string,
  targetLocation: string
): Promise<string | null> {
  try {
    let baseId = id;
    let sourceDir: string;
    let sourceExtIndex: number | null = null;

    const extMatch = id.match(/^ext::(\d+)::(.+)$/);
    const defaultMatch = id.match(/^default::(.+)$/);

    if (extMatch) {
      sourceExtIndex = Number(extMatch[1]);
      baseId = extMatch[2];
      const extBase = await getExternalPath(sourceExtIndex);
      if (!extBase)
        throw new Error(`External path ${sourceExtIndex} not found`);
      sourceDir = path.join(extBase, baseId);
    } else if (defaultMatch) {
      // If id is prefixed with default::, source is fallback default backgrounds dir
      baseId = defaultMatch[1];
      sourceDir = path.join(getBasePath(), "backgrounds", baseId);
    } else {
      // Otherwise, source is user-set defaultBackgroundPath
      sourceDir = path.join(getBackgroundFilePath(), baseId);
    }

    // Determine target base directory and newId
    let targetBaseDir: string;
    let newId: string;
    let uniqueFolderName: string;
    if (targetLocation === "default") {
      targetBaseDir = getBackgroundFilePath();
      uniqueFolderName = await getUniqueBackgroundFolderName(
        targetBaseDir,
        baseId
      );
      newId = uniqueFolderName;
    } else if (targetLocation.startsWith("external:")) {
      const extIdx = Number(targetLocation.split(":")[1]);
      const extBase = await getExternalPath(extIdx);
      if (!extBase) throw new Error(`External path ${extIdx} not found`);
      targetBaseDir = extBase;
      uniqueFolderName = await getUniqueBackgroundFolderName(
        targetBaseDir,
        baseId
      );
      newId = `ext::${extIdx}::${uniqueFolderName}`;
    } else {
      throw new Error("Invalid targetLocation");
    }

    const targetDir = path.join(targetBaseDir, uniqueFolderName);

    // Prevent moving to the same location
    if (sourceDir === targetDir) {
      logger.warn(
        "Source and target directories are the same. No move performed."
      );
      return id;
    }

    // Move the folder
    if (!fs.existsSync(sourceDir))
      throw new Error(
        `Source folder does not exist: ${sourceDir}. target: ${targetDir}`
      );
    if (fs.existsSync(targetDir))
      throw new Error(`Target folder already exists: ${targetDir}`);

    try {
      await fs.promises.rename(sourceDir, targetDir);
    } catch (err) {
      logger.warn(
        `Rename failed (${(err as Error).message}), trying copy+remove...`
      );
      try {
        await fsExtra.copy(sourceDir, targetDir);
        try {
          await fsExtra.remove(sourceDir);
        } catch (removeErr) {
          if (
            removeErr &&
            typeof removeErr === "object" &&
            "code" in removeErr &&
            removeErr.code === "ENOTEMPTY"
          ) {
            logger.warn(
              `Failed to remove source folder after copy (ENOTEMPTY): ${sourceDir}. Some files may be locked/in use. Will retry cleanup in background.`
            );
            // Schedule retries to clean up the folder after a delay
            retryRemoveFolder(sourceDir, 5, 5000);
            // Do not throw, allow move to succeed
          } else {
            logger.error(
              `Failed to move background folder via copy+remove:`,
              removeErr
            );
            throw removeErr;
          }
        }
      } catch (copyErr) {
        logger.error(
          `Failed to move background folder via copy+remove:`,
          copyErr
        );
        throw copyErr;
      }
    }

    logger.info(
      `Moved background folder from ${sourceDir} to ${targetDir}. New ID: ${newId}`
    );
    return newId;
  } catch (e) {
    logger.error("Failed to move background folder:", e);
    return null;
  }
}

/**
 * Finds a unique folder name in the target directory by incrementing a trailing _number if present,
 * or appending _1, _2, etc. if not.
 * Returns the unique folder name (not the full path).
 */
export async function getUniqueBackgroundFolderName(
  baseDir: string,
  baseId: string
): Promise<string> {
  let candidate = baseId;
  let counter = 1;

  // Check if baseId already ends with _number
  const match = baseId.match(/^(.*?)(?:_(\d+))?$/);
  let baseName = baseId;
  let baseNumber = 0;
  if (match) {
    baseName = match[1];
    baseNumber = match[2] ? parseInt(match[2], 10) : 0;
  }

  candidate = baseId;
  while (fs.existsSync(path.join(baseDir, candidate))) {
    counter = baseNumber + 1;
    candidate = `${baseName}_${counter}`;
    baseNumber = counter;
  }
  return candidate;
}

export function calculateSubWindowDimensions(
  defaultWidth: number,
  defaultHeight: number
) {
  const padding = 50;

  // Get current display dimensions
  const currentDisplay = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  const { width: screenWidth, height: screenHeight } =
    currentDisplay.workAreaSize;

  // Check if current window is maximized
  const mainWindow = getMainWindow();
  const isMaximized = mainWindow?.isMaximized() || false;

  let actualWidth, actualHeight;

  if (isMaximized) {
    actualWidth = Math.min(defaultWidth, screenWidth - padding);
    actualHeight = Math.min(defaultHeight, screenHeight - padding);
  } else {
    // Scale based on window dimensions if not fullscreen
    const currentWindowBounds = mainWindow?.getBounds();
    if (currentWindowBounds) {
      const maxWidth = currentWindowBounds.width - padding;
      const maxHeight = currentWindowBounds.height - padding;
      actualWidth = Math.min(defaultWidth, maxWidth);
      actualHeight = Math.min(defaultHeight, maxHeight);
    } else {
      // Fallback to screen dimensions if window dimensions fail
      actualWidth = Math.min(defaultWidth, screenWidth - padding);
      actualHeight = Math.min(defaultHeight, screenHeight - padding);
    }
  }

  return { actualWidth, actualHeight };
}

export async function deleteIconData(profile: string, id: string) {
  const iconFolderPath = path.join(getIconsFolderPath(profile), `${id}`);
  if (fs.existsSync(iconFolderPath)) {
    await shell.trashItem(iconFolderPath);
    logger.info(`Successfully moved folder to recycle bin: ${iconFolderPath}`);
    return true;
  } else {
    logger.warn(`Folder not found: ${iconFolderPath}`);
    return false;
  }
}

export async function getProfiles(): Promise<string[]> {
  const profilesDir = getProfilesPath();
  try {
    const entries = await fs.promises.readdir(profilesDir, {
      withFileTypes: true,
    });
    const profiles = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((profile) => profile !== "desktop_cache");
    return profiles;
  } catch (e) {
    logger.error("Failed to read profiles directory:", e);
    return [];
  }
}

export async function moveDesktopIcon(
  id: string,
  newRow: number,
  newCol: number,
  offsetReset?: boolean
): Promise<boolean> {
  const filePath = await getSelectedProfilePath();

  try {
    logger.info(
      `Updating icon position for id=${id} to [${newRow},${newCol}] in ${filePath}`
    );
    let desktopData: DesktopIconData = { icons: [] };

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      desktopData = JSON.parse(data);
    }

    // Check if another icon already exists at the target row/col
    const conflictIndex = desktopData.icons.findIndex(
      (icon) => icon.row === newRow && icon.col === newCol && icon.id !== id
    );
    if (conflictIndex !== -1) {
      showSmallWindow(
        "Move Icon Error",
        `Cannot move icon: ${id} to [${newRow},${newCol}]: position already occupied by icon: ${desktopData.icons[conflictIndex].id}`,
        ["Okay"]
      );
      logger.error(
        `Cannot move icon ${id} to [${newRow},${newCol}]: position already occupied by icon: ${desktopData.icons[conflictIndex].id}`
      );
      return false;
    }

    // Find icon by id
    const iconIndex = desktopData.icons.findIndex((icon) => icon.id === id);

    if (iconIndex !== -1) {
      // Update only row and col
      desktopData.icons[iconIndex].row = newRow;
      desktopData.icons[iconIndex].col = newCol;

      // Reset offsets if requested
      if (offsetReset) {
        desktopData.icons[iconIndex].offsetX = undefined;
        desktopData.icons[iconIndex].offsetY = undefined;
      }

      fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));
      logger.info(
        `Successfully updated icon position: ${id} to [${newRow},${newCol}]`
      );
      return true;
    } else {
      logger.warn(`Icon with id=${id} not found.`);
      return false;
    }
  } catch (error) {
    logger.error(`Error updating icon position for id=${id}: ${error}`);
    return false;
  }
}

export async function swapDesktopIcons(
  id1: string,
  id2: string
): Promise<boolean> {
  const filePath = await getSelectedProfilePath();

  try {
    logger.info(`Swapping positions of icons ${id1} and ${id2} in ${filePath}`);
    let desktopData: DesktopIconData = { icons: [] };

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      desktopData = JSON.parse(data);
    }

    const iconIndex1 = desktopData.icons.findIndex((icon) => icon.id === id1);
    const iconIndex2 = desktopData.icons.findIndex((icon) => icon.id === id2);

    if (iconIndex1 === -1 || iconIndex2 === -1) {
      logger.error(
        `swapDesktopIcons: One or both icons not found (id1: ${id1}, id2: ${id2}), iconIndex1: ${iconIndex1}, iconIndex2: ${iconIndex2}`
      );
      showSmallWindow(
        "Swap Icons Error",
        `Cannot swap icons: One or both icons not found (id1: ${id1}, id2: ${id2}) iconIndex1: ${iconIndex1}, iconIndex2: ${iconIndex2}`,
        ["Okay"]
      );
      return false;
    }

    // Swap row and col values
    const icon1 = desktopData.icons[iconIndex1];
    const icon2 = desktopData.icons[iconIndex2];

    const tempRow = icon1.row;
    const tempCol = icon1.col;

    icon1.row = icon2.row;
    icon1.col = icon2.col;
    icon2.row = tempRow;
    icon2.col = tempCol;

    // Reset offsets for both icons
    icon1.offsetX = undefined;
    icon1.offsetY = undefined;
    icon2.offsetX = undefined;
    icon2.offsetY = undefined;

    fs.writeFileSync(filePath, JSON.stringify(desktopData, null, 2));
    logger.info(
      `Successfully swapped positions of icons ${id1} and ${id2} and reset offsets.`
    );
    return true;
  } catch (error) {
    logger.error(`Error swapping desktop icons: ${error}`);
    return false;
  }
}

export async function getDesktopIcon(id: string): Promise<DesktopIcon | null> {
  const filePath = await getSelectedProfilePath();

  try {
    logger.info(`Received request for getDesktopIcon with icon id: ${id}`);
    logger.info(`DesktopIcons file path: ${filePath}`);

    // Read JSON file
    const data = fs.readFileSync(filePath, "utf-8");
    logger.info(`Read file contents: ${filePath}`);
    const parsedData: DesktopIconData = JSON.parse(data);

    if (parsedData.icons) {
      // Find the icon with the specified row and col
      const icon = parsedData.icons.find((icon) => icon.id === id);

      if (icon) {
        logger.info(`Found icon ${id}: ${JSON.stringify(icon)}`);
        return icon;
      } else {
        logger.warn(`No icon found ${id}`);
        return null; // Return null if no matching icon is found
      }
    }

    logger.warn("No icons found in the data file.");
    return null; // Return null if no icons exist
  } catch (error) {
    logger.error(`Error reading or parsing JSON file: ${error}`);
    return null; // Return null if an error occurs
  }
}

export async function getSelectedProfilePath(): Promise<string> {
  const profile = await getRendererState("profile");
  let filePath = "";
  if (!profile) {
    filePath = getProfileJsonPath("default"); // Assume default profile (getDesktopIconData returns default if not set.)
  } else {
    filePath = getProfileJsonPath(profile);
  }
  return filePath;
}

export async function ensureProfileFolder(
  profile: string,
  copyFromProfile?: string
): Promise<boolean> {
  try {
    const profilesBase = getProfilesPath();
    const profileFolder = path.join(profilesBase, profile);

    // Ensure profile folder exists
    if (!fs.existsSync(profileFolder)) {
      logger.info(
        `Profile folder ${profile} does not exist, creating: ${profileFolder}`
      );
      fs.mkdirSync(profileFolder, { recursive: true });
      logger.info(`Profile folder ${profile} created successfully.`);
    }

    const iconsFolderPath = path.join(profileFolder, "icons");
    if (!fs.existsSync(iconsFolderPath)) {
      fs.mkdirSync(iconsFolderPath, { recursive: true });
      logger.info(`Created icons folder: ${iconsFolderPath}`);
    }

    // Ensure profile.json exists in the profile folder
    const profileJsonPath = path.join(profileFolder, "profile.json");

    if (copyFromProfile) {
      const copyFromPath = path.join(
        profilesBase,
        copyFromProfile,
        "profile.json"
      );
      if (!fs.existsSync(copyFromPath)) {
        logger.error(`Copy source profile.json not found: ${copyFromPath}`);
        showSmallWindow(
          "Error copying profile",
          `The profile to copy from does not exist. ${copyFromPath}`,
          ["OK"]
        );
        return false;
      }
      const copiedData = fs.readFileSync(copyFromPath, "utf-8");

      if (fs.existsSync(profileJsonPath)) {
        // Backup the existing profile.json
        const backupPath = path.join(profileFolder, "backup.json");
        fs.renameSync(profileJsonPath, backupPath);
        logger.info(`Existing profile.json backed up to backup.json`);
      }

      fs.writeFileSync(profileJsonPath, copiedData, "utf-8");
      logger.info(`Copied profile.json from ${copyFromProfile} to ${profile}`);

      const oldIconsFolder = path.join(profilesBase, copyFromProfile, "icons");
      if (fs.existsSync(oldIconsFolder)) {
        const newIconsFolder = iconsFolderPath;
        // Copy all folders/files from old profile to new profile's icons folder
        const items = fs.readdirSync(oldIconsFolder, { withFileTypes: true });
        for (const item of items) {
          const srcPath = path.join(oldIconsFolder, item.name);
          const destPath = path.join(newIconsFolder, item.name);
          if (item.isDirectory()) {
            // Recursively copy directory
            fsExtra.copySync(srcPath, destPath, { overwrite: true });
          } else if (item.isFile()) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
        logger.info(
          `Copied icons folder from ${copyFromProfile} to ${profile}`
        );
      } else {
        logger.warn(
          `Source icons folder does not exist: ${oldIconsFolder}, skipping icons copy.`
        );
      }
    } else if (!fs.existsSync(profileJsonPath)) {
      logger.info(
        `profile.json not found in ${profileFolder}, creating default profile.json.`
      );
      fs.writeFileSync(
        profileJsonPath,
        JSON.stringify({ icons: [] }, null, 2),
        "utf-8"
      );
    }

    return true;
  } catch (error) {
    logger.error(`Error ensuring profile folder ${profile}: ${error}`);
    return false;
  }
}

/**
 * Checks if the provided directory path is readable and writable.
 * Returns true if both permissions are granted, false otherwise.
 */
export async function canReadWriteDir(dirPath: string): Promise<boolean> {
  if (!path.isAbsolute(dirPath)) {
    logger.warn(`Provided path is not absolute: ${dirPath}`);
    await showSmallWindow(
      "Invalid Path",
      `The path "${dirPath}" is not an absolute path.\nPlease enter a valid folder path.`,
      ["OK"]
    );
    return false;
  }
  try {
    // Check if directory exists and is readable
    await fs.promises.access(dirPath, fs.constants.R_OK);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    logger.warn(`Cannot read directory: ${dirPath}`, err);

    let reason = "The directory does not exist or is not readable.";
    if (err.code === "ENOENT") {
      reason = "The directory does not exist.";
    } else if (err.code === "EACCES") {
      reason = "Permission denied. Cannot access this directory.";
    }

    await showSmallWindow(
      "External Path Error",
      `${reason}\nPath: ${dirPath}\nPlease check the location or choose another directory.`,
      ["OK"]
    );

    return false;
  }

  // Try to create and delete a temp file to verify write access
  const testFile = path.join(
    dirPath,
    `.__alt_desktop_write_test_${Date.now()}`
  );

  try {
    await fs.promises.writeFile(testFile, "test");
    await fs.promises.unlink(testFile);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    logger.warn(`Cannot write to directory: ${dirPath}`, err);
    await showSmallWindow(
      "External Path Error",
      `Cannot write to directory: ${dirPath}\nPlease check permissions or choose another directory.`,
      ["OK"]
    );
    return false;
  }
}

async function retryRemoveFolder(
  folderPath: string,
  maxAttempts = 5,
  delayMs = 5000
): Promise<boolean> {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fsExtra.remove(folderPath);
      logger.info(`Successfully removed folder after retry: ${folderPath}`);
      return true;
    } catch (err: unknown) {
      const isLast = attempt === maxAttempts;

      if (typeof err === "object" && err !== null && "code" in err) {
        const code = err.code;
        if (
          ["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"].includes(code as string)
        ) {
          logger.warn(
            `Attempt ${attempt} failed with lock error (${code}): ${folderPath}` +
              (isLast
                ? " No more retries."
                : ` Retrying in ${delayMs * Math.pow(2, attempt - 1)}ms...`),
            err
          );
        } else {
          logger.warn(
            `Attempt ${attempt} to remove folder failed: ${folderPath}` +
              (isLast
                ? " No more retries."
                : ` Retrying in ${delayMs * Math.pow(2, attempt - 1)}ms...`),
            err
          );
        }
      } else {
        logger.warn(
          `Attempt ${attempt} failed with unknown error type: ${err}`,
          err
        );
      }

      if (isLast) return false;
      await sleep(delayMs * Math.pow(2, attempt - 1));
    }
  }

  return false;
}

/**
 * Saves an image file to the icon's data folder.
 * Returns the local file name (e.g. "icon.png").
 */
export function saveImageToIconFolder(
  sourcePath: string,
  profile: string,
  id: string
): string {
  const targetDir = path.join(getIconsFolderPath(profile), `${id}`);

  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);

  // Verify that the source file exists
  if (!fs.existsSync(sourcePath)) {
    logger.error(
      `saveImageToIconFolder Source file does not exist: ${sourcePath}`
    );
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  // Ensure the target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // If already in the target directory, just return the file name
  if (sourcePath.startsWith(targetDir)) {
    logger.info("Source already in target directory, skipping copy.");
    return path.basename(sourcePath);
  }

  // Check for existing files with the same name or name with a counter
  const filesInDir = fs.readdirSync(targetDir);
  for (const file of filesInDir) {
    logger.info(`Checking file: ${file}`);
    const fileExt = path.extname(file);
    const fileBaseName = path.basename(file, fileExt);

    // Match files with the same base name or base name with a counter
    const escapedBaseName = escapeRegExp(baseName);
    const baseNameRegex = new RegExp(`^${escapedBaseName}(\\(\\d+\\))?$`, "i");
    if (
      baseNameRegex.test(fileBaseName) &&
      fileExt.toLowerCase() === ext.toLowerCase()
    ) {
      const existingFilePath = path.join(targetDir, file);
      logger.info(`Found matching base name file: ${existingFilePath}`);
      // Compare the two files to see if they are the same
      if (
        fs.readFileSync(sourcePath).equals(fs.readFileSync(existingFilePath))
      ) {
        logger.info(`Matching file found: ${file}`);
        return file; // Return the matching file's name
      }
    }
  }

  let localFileName = `${baseName}${ext}`;
  let targetPath = path.join(targetDir, localFileName);
  let counter = 1;

  // Increment filename if it already exists
  while (fs.existsSync(targetPath)) {
    localFileName = `${baseName}(${counter})${ext}`;
    targetPath = path.join(targetDir, localFileName);
    counter++;
  }
  fs.copyFileSync(sourcePath, targetPath);
  logger.info(`Image saved to: ${targetPath}`);

  return localFileName;
}

export async function getDesktopUniqueFiles(
  profile?: string,
  existingIcons?: DesktopIcon[]
): Promise<{
  filesToImport: Array<{ name: string; path: string }>;
  alreadyImported: Array<{ name: string; path: string; icon: DesktopIcon }>;
  nameOnlyMatches: Array<{ name: string; path: string; icon: DesktopIcon }>;
  pathOnlyMatches: Array<{ name: string; path: string; icon: DesktopIcon }>;
}> {
  const failedResult = {
    filesToImport: [],
    alreadyImported: [],
    nameOnlyMatches: [],
    pathOnlyMatches: [],
  };
  if (!profile) {
    try {
      profile = await getRendererState("profile");
      if (!profile) {
        logger.error("No profile found via getRendererState");
        return failedResult;
      }
    } catch (error) {
      logger.error("Failed to get profile from getRendererState:", error);
      return failedResult;
    }
  }

  const desktopPath = path.join(process.env.USERPROFILE || "", "Desktop");
  if (!fs.existsSync(desktopPath)) {
    logger.warn(`Desktop path does not exist: ${desktopPath}`);
    return failedResult;
  }

  const files = await fs.promises.readdir(desktopPath);
  logger.info("Files on Desktop:", files);

  // Only fetch existingIcons if not provided
  let icons: DesktopIcon[] = [];
  if (existingIcons) {
    icons = existingIcons;
  } else {
    const profileJsonPath = getProfileJsonPath(profile);
    if (fs.existsSync(profileJsonPath)) {
      try {
        const data = fs.readFileSync(profileJsonPath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);
        icons = parsedData.icons || [];
      } catch (e) {
        logger.warn("Failed to read profile icon data:", e);
      }
    }
  }

  // Find a matching icon for a desktop file (by programLink + name)
  function findMatchingIcon(
    filePath: string,
    candidateName: string
  ): { exact?: DesktopIcon; nameOnly?: DesktopIcon; pathOnly?: DesktopIcon } {
    const normFilePath = path.resolve(filePath).toLowerCase();
    const standardizedCandidateName = standardizeIconName(candidateName);

    let exact: DesktopIcon | undefined;
    let nameOnly: DesktopIcon | undefined;
    let pathOnly: DesktopIcon | undefined;

    for (const icon of icons) {
      const iconPath = icon.programLink
        ? path.resolve(icon.programLink).toLowerCase()
        : "";
      const standardizedIconName = standardizeIconName(icon.name);
      const nameMatches = standardizedIconName === standardizedCandidateName;
      const pathMatches = iconPath === normFilePath;

      if (nameMatches && pathMatches) {
        exact = icon;
      } else if (nameMatches && !pathMatches) {
        nameOnly = icon;
      } else if (!nameMatches && pathMatches) {
        pathOnly = icon;
      }
    }

    if (nameOnly || pathOnly) {
      logger.info(
        `Partial match found for "${candidateName}" (${filePath}):`,
        JSON.stringify({
          nameOnlyMatch: nameOnly
            ? `Icon: ${nameOnly.name} (${nameOnly.programLink})`
            : undefined,
          pathOnlyMatch: pathOnly
            ? `Icon: ${pathOnly.name} (${pathOnly.programLink})`
            : undefined,
        })
      );
    }

    return { exact, nameOnly, pathOnly };
  }

  const filesToImport: Array<{ name: string; path: string }> = [];
  const alreadyImported: Array<{
    name: string;
    path: string;
    icon: DesktopIcon;
  }> = [];
  const nameOnlyMatches: Array<{
    name: string;
    path: string;
    icon: DesktopIcon;
  }> = [];
  const pathOnlyMatches: Array<{
    name: string;
    path: string;
    icon: DesktopIcon;
  }> = [];
  const desktopFiles: Array<{ name: string; path: string }> = [];

  for (const file of files) {
    if (file.toLowerCase() === "desktop.ini") continue;
    const candidatePath = path.join(desktopPath, file);
    desktopFiles.push({ name: file, path: candidatePath });

    const matches = findMatchingIcon(candidatePath, file);

    if (matches.exact) {
      alreadyImported.push({
        name: file,
        path: candidatePath,
        icon: matches.exact,
      });
    } else if (matches.nameOnly) {
      nameOnlyMatches.push({
        name: file,
        path: candidatePath,
        icon: matches.nameOnly,
      });
    } else if (matches.pathOnly) {
      pathOnlyMatches.push({
        name: file,
        path: candidatePath,
        icon: matches.pathOnly,
      });
    } else {
      filesToImport.push({ name: file, path: candidatePath });
    }
  }

  return { filesToImport, alreadyImported, nameOnlyMatches, pathOnlyMatches };
}

export async function importDesktopFileAsIcon(
  file: { name: string; path: string },
  profile: string,
  takenCoords: Set<string>,
  maxRows: number,
  mainWindow?: BrowserWindow
): Promise<DesktopIcon | null> {
  const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;
  try {
    const sanitizedName = file.name.replace(INVALID_FOLDER_CHARS, "");
    const iconId = await ensureUniqueIconId(profile, sanitizedName);
    if (!iconId) {
      logger.error(
        `Failed to generate unique icon ID for ${file.name} -> ${sanitizedName}`
      );
      return null;
    }

    const iconFolder = path.join(getIconsFolderPath(profile), iconId);
    if (!fs.existsSync(iconFolder)) {
      fs.mkdirSync(iconFolder, { recursive: true });
    }

    let image = "";
    let mimeType = getMimeType(file.path);

    if (!mimeType) {
      logger.warn(`Could not determine MIME type for file: ${file.path}`);
      mimeType = "unknown";
    }

    // If it's an image, save directly. Otherwise, generate icon.
    if (mimeType.startsWith("image/")) {
      image = saveImageToIconFolder(file.path, profile, iconId);
    } else {
      const generatedImages = await generateIcon(iconFolder, file.path, "");
      image = generatedImages[0] || "";
      logger.info("Generated icon image:", image);
    }

    // Find next available coordinate
    function getNextAvailableCoordinate(): { row: number; col: number } {
      let col = 0;
      let row = 0;
      while (true) {
        if (!takenCoords.has(`${row},${col}`)) {
          takenCoords.add(`${row},${col}`);
          return { row, col };
        }
        row++;
        if (row >= (typeof maxRows === "number" ? maxRows : 10)) {
          row = 0;
          col++;
        }
      }
    }
    const { row, col } = getNextAvailableCoordinate();

    const icon: DesktopIcon = {
      id: iconId,
      name: file.name,
      row,
      col,
      image,
      programLink: file.path,
      launchDefault: "program",
    };

    logger.info(`Importing icon at (${row},${col}):`, JSON.stringify(icon));
    const saved = await saveIcon(null, icon, profile);
    if (saved) {
      if (mainWindow) {
        // Only trigger reload if imported to current profile (otherwise this saves a blank icon on current profile).
        if (profile === (await getRendererState("profile"))) {
          mainWindow.webContents.send("reload-icon", { id: icon.id, icon });
        }
      }
      return icon;
    } else {
      logger.warn(`Failed to save icon from Desktop: ${icon.name}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error importing ${file.name}:`, error);
    return null;
  }
}

async function loadExistingIconsAndTakenCoords(profile: string) {
  const profileJsonPath = getProfileJsonPath(profile);
  let existingIcons: DesktopIcon[] = [];
  if (fs.existsSync(profileJsonPath)) {
    try {
      const data = fs.readFileSync(profileJsonPath, "utf-8");
      const parsedData: DesktopIconData = JSON.parse(data);
      existingIcons = parsedData.icons || [];
    } catch (e) {
      logger.warn("Failed to read profile icon data:", e);
    }
  }
  const takenCoords = new Set(
    existingIcons.map((icon) => `${icon.row},${icon.col}`)
  );
  return { existingIcons, takenCoords };
}

export async function importAllIconsFromDesktop(
  mainWindow: BrowserWindow,
  profile: string
): Promise<boolean> {
  try {
    const { existingIcons, takenCoords } =
      await loadExistingIconsAndTakenCoords(profile);
    // Fetch current profile's DesktopIconData

    const { filesToImport } = await getDesktopUniqueFiles(
      profile,
      existingIcons
    );

    if (!filesToImport.length) {
      logger.warn("No new files found on Desktop to import as icons.");
      return true;
    }

    logger.info(`Found ${filesToImport.length} new files to import.`);

    const importIcons = await showSmallWindow(
      "Import Desktop Icons",
      `Found ${filesToImport.length} new unique Desktop icon(s).\nWould you like to import them?`,
      ["Import", "Cancel"]
    );

    if (importIcons === "Import") {
      const maxRows = (await getRendererState("visibleRows")) || 10;

      const importedIcons: DesktopIcon[] = [];

      // import all icons from filesToImport
      for (const file of filesToImport) {
        const icon = await importDesktopFileAsIcon(
          file,
          profile,
          takenCoords,
          maxRows,
          mainWindow
        );
        if (icon) {
          importedIcons.push(icon);
        }
      }

      logger.info(`Successfully imported ${importedIcons.length} icons.`);
      return true;
    } else {
      logger.info("User cancelled icon import from Desktop.");
      return false;
    }
  } catch (error) {
    logger.error("Error importing icons from desktop:", error);
    return false;
  }
}

export async function ensureUniqueIconId(
  profile: string,
  name: string
): Promise<string | null> {
  logger.info("ensureUniqueIconId called with: ", name);

  if (name === undefined || name === null || name.trim() === "") {
    logger.warn("Icon name is empty after trimming, setting to 'unknownIcon'");
    name = "unknownIcon";
  }

  const baseName = name;
  const dataFolder = getIconsFolderPath(profile);

  let folderNames: string[] = [];
  try {
    if (!fs.existsSync(dataFolder)) {
      logger.error("Data folder does not exist: " + dataFolder);
      return null;
    }
    folderNames = fs
      .readdirSync(dataFolder, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (e) {
    logger.error("Failed to read data folder:", e);
    return null;
  }

  // Ensure case-insensitive (Windows folders are case-insensitive)
  const lowerBaseName = baseName.toLowerCase();
  const takenIds = new Set(
    folderNames
      .filter((id) => {
        if (!id) return false;
        // Match baseName or baseName_N (where N is a number)
        const lowerId = id.toLowerCase();
        return (
          lowerId === lowerBaseName ||
          lowerId.match(
            new RegExp(`^${escapeRegExp(lowerBaseName)}(_\\d+)?$`, "i")
          )
        );
      })
      .map((id) => id.toLowerCase())
  );

  // If baseName is not taken, use it
  if (!takenIds.has(lowerBaseName)) {
    return baseName;
  }

  // Otherwise, find the next available baseName_N
  let counter = 1;
  let candidate = `${baseName}_${counter}`;
  let lowerCandidate = candidate.toLowerCase();
  while (takenIds.has(lowerCandidate)) {
    counter++;
    candidate = `${baseName}_${counter}`;
    lowerCandidate = candidate.toLowerCase();
  }
  return candidate;
}

export async function compareProfiles(
  currentProfile: string,
  otherProfile: string
): Promise<ProfileIconCompare> {
  try {
    // Load icons from both profiles
    const currentProfilePath = getProfileJsonPath(currentProfile);
    const otherProfilePath = getProfileJsonPath(otherProfile);

    let currentIcons: DesktopIcon[] = [];
    let otherIcons: DesktopIcon[] = [];

    // Load current profile icons
    if (fs.existsSync(currentProfilePath)) {
      try {
        const data = fs.readFileSync(currentProfilePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);
        currentIcons = parsedData.icons || [];
      } catch (e) {
        logger.warn(
          `Failed to read current profile icons from ${currentProfilePath}:`,
          e
        );
      }
    }

    // Load other profile icons
    if (fs.existsSync(otherProfilePath)) {
      try {
        const data = fs.readFileSync(otherProfilePath, "utf-8");
        const parsedData: DesktopIconData = JSON.parse(data);
        otherIcons = parsedData.icons || [];
      } catch (e) {
        logger.warn(
          `Failed to read other profile icons from ${otherProfilePath}:`,
          e
        );
      }
    }

    // Fields to compare (excluding position/layout fields)
    const fieldsToCompare: (keyof DesktopIcon)[] = [
      "name",
      "image",
      "programLink",
      "args",
      "websiteLink",
      "fontColor",
    ];

    // Normalize values - treat empty strings and undefined/null as equivalent
    const normalizeValue = (
      val: string | string[] | undefined
    ): string | string[] | null => {
      if (val === "" || val === undefined || val === null) {
        return null;
      }
      return val;
    };

    // Helper function to compare two icons and return differences
    const getIconDifferences = (
      icon1: DesktopIcon,
      icon2: DesktopIcon
    ): string[] => {
      const differences: string[] = [];
      for (const field of fieldsToCompare) {
        const val1 = icon1[field];
        const val2 = icon2[field];

        const normalized1 = normalizeValue(
          val1 as string | string[] | undefined
        );
        const normalized2 = normalizeValue(
          val2 as string | string[] | undefined
        );

        // Deep comparison for arrays
        if (Array.isArray(normalized1) && Array.isArray(normalized2)) {
          if (JSON.stringify(normalized1) !== JSON.stringify(normalized2)) {
            differences.push(field);
          }
        } else if (normalized1 !== normalized2) {
          differences.push(field);
        }
      }
      return differences;
    };

    // Helper function to count matching fields (for finding best match)
    const countMatchingFields = (
      icon1: DesktopIcon,
      icon2: DesktopIcon
    ): number => {
      let matches = 0;
      for (const field of fieldsToCompare) {
        const val1 = icon1[field];
        const val2 = icon2[field];

        const normalized1 = normalizeValue(
          val1 as string | string[] | undefined
        );
        const normalized2 = normalizeValue(
          val2 as string | string[] | undefined
        );

        if (Array.isArray(normalized1) && Array.isArray(normalized2)) {
          if (JSON.stringify(normalized1) === JSON.stringify(normalized2)) {
            matches++;
          }
        } else if (normalized1 === normalized2) {
          matches++;
        }
      }
      return matches;
    };

    // Create lookup maps for current profile icons
    const currentIconsByNormalizedName = new Map<string, DesktopIcon[]>();
    const currentIconsByImage = new Map<string, DesktopIcon[]>();

    for (const icon of currentIcons) {
      const normalizedName = standardizeIconName(icon.name);
      if (!currentIconsByNormalizedName.has(normalizedName)) {
        currentIconsByNormalizedName.set(normalizedName, []);
      }
      currentIconsByNormalizedName.get(normalizedName)!.push(icon);

      if (icon.image && !currentIconsByImage.has(icon.image)) {
        currentIconsByImage.set(icon.image, []);
      }
      if (icon.image) {
        currentIconsByImage.get(icon.image)!.push(icon);
      }
    }

    const filesToImport: DesktopIcon[] = [];
    const alreadyImported: DesktopIcon[] = [];
    const modified: Array<{
      otherIcon: DesktopIcon;
      currentIcon: DesktopIcon;
      differences: string[];
    }> = [];

    for (const otherIcon of otherIcons) {
      const normalizedName = standardizeIconName(otherIcon.name);

      // Find potential matches by name or filepath
      const nameMatches =
        currentIconsByNormalizedName.get(normalizedName) || [];
      const imageMatches = otherIcon.image
        ? currentIconsByImage.get(otherIcon.image) || []
        : [];

      // Combine and deduplicate potential matches
      const potentialMatches = new Map<string, DesktopIcon>();
      for (const match of [...nameMatches, ...imageMatches]) {
        potentialMatches.set(match.id, match);
      }

      const matchArray = Array.from(potentialMatches.values());

      if (matchArray.length === 0) {
        // No match found - this is a new icon to import
        filesToImport.push(otherIcon);
      } else {
        // Find the best match based on number of matching fields
        let bestMatch = matchArray[0];
        let bestMatchScore = countMatchingFields(otherIcon, bestMatch);

        for (let i = 1; i < matchArray.length; i++) {
          const matchScore = countMatchingFields(otherIcon, matchArray[i]);
          if (matchScore > bestMatchScore) {
            bestMatch = matchArray[i];
            bestMatchScore = matchScore;
          }
        }

        // Check if there are any differences
        const differences = getIconDifferences(otherIcon, bestMatch);

        if (differences.length === 0) {
          // Icons are identical (excluding position fields)
          alreadyImported.push(otherIcon);
        } else {
          // Icons have differences
          modified.push({
            otherIcon: otherIcon,
            currentIcon: bestMatch,
            differences,
          });
        }
      }
    }

    return {
      filesToImport,
      alreadyImported,
      modified,
    };
  } catch (error) {
    logger.error(
      `Error comparing profiles ${currentProfile} and ${otherProfile}:`,
      error
    );
    return {
      filesToImport: [],
      alreadyImported: [],
      modified: [],
    };
  }
}

// Function to solve for file/icon named '2.png' vs icon named '2' (only missing extensions)
function standardizeIconName(name: string): string {
  // Split by the last dot to separate name from potential extension
  const lastDotIndex = name.lastIndexOf(".");

  // If no dot found, return the name
  if (lastDotIndex === -1) {
    return name;
  }

  const potentialExt = name.substring(lastDotIndex + 1).toLowerCase();
  // Check if it looks like a valid extension:
  // - > 1 character after '.'
  // - Only alphanumeric characters (no spaces, special chars)
  const isValidExtension =
    potentialExt.length > 0 && /^[a-z0-9]+$/.test(potentialExt);

  if (isValidExtension) {
    return name.substring(0, lastDotIndex);
  }
  return name;
}

// Manual addition of .url MIME type otherwise mime.lookup returns ""
export function getMimeType(filePath: string): string | false {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".url") {
    return "application/x-url";
  }
  return mime.lookup(filePath);
}

export async function importIconFromProfile(
  currentProfile: string,
  fromProfile: string,
  icon?: DesktopIcon
): Promise<DesktopIcon | null> {
  try {
    if (!icon) {
      logger.warn("No icon provided to import");
      return null;
    }

    // Load the icon from the fromProfile
    const fromProfilePath = getProfileJsonPath(fromProfile);
    if (!fs.existsSync(fromProfilePath)) {
      logger.error(`Profile file does not exist: ${fromProfilePath}`);
      return null;
    }

    let fromProfileData: DesktopIconData | null = null;
    try {
      const data = fs.readFileSync(fromProfilePath, "utf-8");
      fromProfileData = JSON.parse(data);
    } catch (e) {
      logger.error(`Failed to read profile file: ${fromProfilePath}`, e);
      return null;
    }

    if (!fromProfileData || !fromProfileData.icons) {
      logger.warn("No icons found in from profile");
      return null;
    }

    // Find the icon in the fromProfile
    const sourceIcon = fromProfileData.icons.find((i) => i.id === icon.id);

    if (!sourceIcon) {
      logger.error(`Icon not found in source profile: ${icon.name}`);
      return null;
    }

    // Load current profile to check for taken coordinates
    const currentProfilePath = getProfileJsonPath(currentProfile);
    let currentProfileData: DesktopIconData = {
      icons: [],
    };

    if (fs.existsSync(currentProfilePath)) {
      try {
        const data = fs.readFileSync(currentProfilePath, "utf-8");
        currentProfileData = JSON.parse(data);
      } catch (e) {
        logger.warn(
          `Failed to read current profile file: ${currentProfilePath}`,
          e
        );
      }
    }

    // Get taken coordinates
    const takenCoords = new Set(
      (currentProfileData.icons || []).map((i) => `${i.row},${i.col}`)
    );

    const newIconId = await ensureUniqueIconId(currentProfile, sourceIcon.name);
    if (!newIconId) {
      logger.error("Failed to generate unique icon ID");
      return null;
    }

    // Copy the image folder from source profile to current profile
    const sourceIconFolder = path.join(
      getIconsFolderPath(fromProfile),
      sourceIcon.id
    );
    const targetIconFolder = path.join(
      getIconsFolderPath(currentProfile),
      newIconId
    );

    if (fs.existsSync(sourceIconFolder)) {
      // Ensure target folder exists
      if (!fs.existsSync(targetIconFolder)) {
        fs.mkdirSync(targetIconFolder, { recursive: true });
      }

      // Copy all image files from source to target
      const files = fs.readdirSync(sourceIconFolder);
      for (const file of files) {
        const sourceFile = path.join(sourceIconFolder, file);
        const targetFile = path.join(targetIconFolder, file);
        if (fs.statSync(sourceFile).isFile()) {
          fs.copyFileSync(sourceFile, targetFile);
        }
      }
    }

    // Find next available coordinate for the new icon
    let row = 0;
    let col = 0;
    const rendererStates = await getRendererStates();
    const maxRows = rendererStates.visibleRows || 10;

    while (takenCoords.has(`${row},${col}`)) {
      row++;
      if (row >= maxRows) {
        row = 0;
        col++;
      }
    }

    // Create the new icon with the current profile's row/col
    const newIcon: DesktopIcon = {
      ...sourceIcon,
      id: newIconId,
      row,
      col,
    };

    // Add the icon to the current profile
    if (!currentProfileData.icons) {
      currentProfileData.icons = [];
    }

    currentProfileData.icons.push(newIcon);

    // Save the updated profile
    try {
      fs.writeFileSync(
        currentProfilePath,
        JSON.stringify(currentProfileData, null, 2),
        "utf-8"
      );
      logger.info(
        `Successfully imported icon ${newIconId} from profile ${fromProfile}`
      );

      // Send reload notification to main window
      if (mainWindow) {
        mainWindow.webContents.send("reload-icon", {
          id: newIcon.id,
          icon: newIcon,
        });
      } else {
        logger.error(
          "mainWindow is not defined, cannot send reload-icon message"
        );
      }
    } catch (e) {
      logger.error(
        `Failed to save current profile file: ${currentProfilePath}`,
        e
      );
      return null;
    }

    return newIcon;
  } catch (error) {
    logger.error("Error importing icon from profile:", error);
    return null;
  }
}

/**
 *
 * @param oldIcon - The previous icon data (null if new icon)
 * @param newIcon - The new icon data to save
 * @param profile - The profile to save to (optional, uses renderer state if not provided)
 * @param checkFields - Whether to validate fields like programLink (returns success = false and does not save if invalid)
 * @returns Object with success status, new ID, validation results, and error messages
 */
export async function saveIcon(
  oldIcon: DesktopIcon | null,
  newIcon: DesktopIcon,
  profile?: string,
  checkFields?: boolean
): Promise<{
  success: boolean;
  newID?: string;
  checkResults?: { programLinkValid: boolean };
  error?: string;
}> {
  try {
    // determine profile (use provided or fallback to renderer state)
    let useProfile = profile;
    if (!useProfile) {
      useProfile = await getRendererState("profile");
      if (!useProfile) {
        logger.warn("No profile available to save icon.");
        return { success: false, error: "no_profile" };
      }
    }

    const profileJsonPath = getProfileJsonPath(useProfile);
    if (!fs.existsSync(profileJsonPath)) {
      logger.warn(`Profile file not found: ${profileJsonPath}`);
      return { success: false, error: "profile_not_found" };
    }

    const oldId = oldIcon?.id ?? newIcon.id;
    let newId = newIcon.id;
    const baseOldId = (oldId || "").match(/^(.*?)(?:_\d+)?$/)?.[1] || oldId;
    const iconName = (newIcon.name || "").trim();
    let nameChanged = false;

    // Determine new id if name changed or unnamed new icon
    if (oldIcon && !iconName) {
      const gen = await ensureUniqueIconId(useProfile, "unknownIcon");
      if (gen === null) return { success: false, error: "failed_read" };
      newId = gen;
      nameChanged = true;
    } else if (iconName && baseOldId !== iconName) {
      const gen = await ensureUniqueIconId(useProfile, iconName);
      if (gen === null) return { success: false, error: "failed_read" };
      newId = gen;
      nameChanged = true;
    }

    // Early field checks (currently only programLink)
    const programTypeEarly = getMimeType(newIcon.programLink || "");
    const validProgram = !!programTypeEarly;
    if (checkFields && newIcon.programLink && !validProgram) {
      logger.warn(`Invalid program link: ${newIcon.programLink}`);
      return {
        success: false,
        error: "invalid_program_link",
        checkResults: { programLinkValid: false },
      };
    }

    // If name changed and id differs, attempt rename of folder to newId
    if (nameChanged && newId !== oldId) {
      try {
        const dataFolder = getIconsFolderPath(useProfile);
        const oldPath = path.join(dataFolder, oldId);
        const newPath = path.join(dataFolder, newId);
        if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
          logger.info(`Renamed data folder ${oldPath} -> ${newPath}`);
        }
      } catch (e) {
        logger.warn(`Failed to rename data folder ${oldId} -> ${newId}:`, e);
        return { success: false, error: "failed_rename_folder" };
      }
    }

    // If image is an external path, try to copy it to the icon folder
    const driveLetterRegex = /^[a-zA-Z]:[\\/]/;
    if (newIcon.image && driveLetterRegex.test(newIcon.image)) {
      const fileType = getMimeType(newIcon.image as string);
      if (
        fileType &&
        typeof fileType === "string" &&
        fileType.startsWith("image/")
      ) {
        try {
          const savedFile = saveImageToIconFolder(
            newIcon.image as string,
            useProfile,
            newId
          );
          newIcon.image = savedFile;
        } catch (e) {
          logger.error("Failed to save image to icon folder:", e);
          // TODO Not sure if we should return false here, as we already renamed the folder above.
          // probably just show the error in a small window
        }
      }
    }

    // Read profile json and update icon entry
    const data = fs.readFileSync(profileJsonPath, "utf-8");
    const parsed: DesktopIconData = JSON.parse(data);
    parsed.icons = Array.isArray(parsed.icons) ? parsed.icons : [];

    // ensure newIcon.id is set
    newIcon.id = newId;

    const existingIndex = parsed.icons.findIndex((i) => i.id === oldId);
    if (existingIndex !== -1) {
      parsed.icons[existingIndex] = newIcon;
    } else {
      parsed.icons.push(newIcon);
    }

    fs.writeFileSync(profileJsonPath, JSON.stringify(parsed, null, 2), "utf-8");

    return {
      success: true,
      newID: newId,
      checkResults: { programLinkValid: validProgram },
    };
  } catch (error) {
    logger.error("saveIcon failed:", error);
    return { success: false, error: String(error) };
  }
}
