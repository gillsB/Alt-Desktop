import {
  BrowserWindow,
  ipcMain,
  shell,
  WebContents,
  WebFrameMain,
} from "electron";
import fs from "fs";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { getSetting } from "../settings.js";
import {
  getAllowedUrls,
  openSmallWindow,
} from "../windows/subWindowManager.js";

const logger = createLoggerForFile("util.ts");

let isSubWindowDevtoolsEnabled = false;
let isSmallWindowDevtoolsEnabled = false;

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
    if (!event.senderFrame) {
      throw new Error("Event sender frame is null");
    }
    validateEventFrame(event.senderFrame);
    return handler(...args);
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
      logger.error(
        "Error: file does not exist, When it should, fallback creating:",
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
export function resetAllIconsFontColor(): boolean {
  try {
    const filePath = getDesktopIconsFilePath();
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
 * Saves the provided externalPaths array to backgrounds.json under the "externalPaths" key.
 * @param paths string[] - The array of external paths to save.
 */
export async function saveExternalPaths(paths: string[]) {
  const backgroundsJsonPath = getBackgroundsJsonFilePath();
  try {
    // Read existing backgrounds.json
    const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
    const data = JSON.parse(raw);

    // Set or update the externalPaths property
    data.externalPaths = paths;

    // Write back to backgrounds.json
    await fs.promises.writeFile(
      backgroundsJsonPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    logger.info("Saved externalPaths to backgrounds.json:", paths);
  } catch (error) {
    logger.error("Failed to save externalPaths to backgrounds.json:", error);
  }
}

/**
 * Indexes all background folders in the AppData/Roaming/AltDesktop/backgrounds directory.
 * It reads the directory, checks for subfolders containing a bg.json file, if found adds them to backgrounds.json.
 */
export async function indexBackgrounds() {
  const backgroundsDir = getBackgroundFilePath();
  const backgroundsJsonPath = getBackgroundsJsonFilePath();

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

  // External Paths
  let externalPaths: string[] = [];
  if (fs.existsSync(backgroundsJsonPath)) {
    try {
      const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.externalPaths)) {
        externalPaths = data.externalPaths.filter(
          (p: string) => typeof p === "string"
        );
      }
    } catch (e) {
      logger.warn("Failed to read externalPaths from backgrounds.json:", e);
    }
  }
  for (const extDir of externalPaths) {
    if (!fs.existsSync(extDir)) continue;
    try {
      const extEntries = await fs.promises.readdir(extDir, {
        withFileTypes: true,
      });
      for (const entry of extEntries) {
        if (entry.isDirectory()) {
          const subfolderPath = path.join(extDir, entry.name);
          const bgJsonPath = path.join(subfolderPath, "bg.json");
          if (fs.existsSync(bgJsonPath)) {
            const id = `ext::${externalPaths.indexOf(extDir)}::${entry.name}`;
            subfoldersWithBgJson.push(id);
          }
        }
      }
    } catch (e) {
      logger.warn(`Failed to index external backgrounds in ${extDir}:`, e);
    }
  }

  const validIds = new Set(subfoldersWithBgJson);

  // Check if backgrounds.json exists
  if (!fs.existsSync(backgroundsJsonPath)) {
    const errorMsg =
      `backgrounds.json does not exist at: ${backgroundsJsonPath}` +
      "Restore backgrounds.json or restart program to build backgrounds.json";
    logger.error(errorMsg);
    await openSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
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
      await openSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
      throw new Error(errorMsg);
    }
  } catch (e) {
    const errorMsg = `Failed to parse backgrounds.json: ${e}`;
    logger.error(errorMsg);
    await openSmallWindow("Backgrounds Error", errorMsg, ["Okay"]);
    throw new Error(errorMsg);
  }

  // Add new backgrounds if not already present
  let updated = false;
  let foundUnindexedBgJson = false;
  let importWithSavedDate = false;

  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      foundUnindexedBgJson = true;
    }
  }

  // If any unindexed bg.json are found, prompt the user once
  if (foundUnindexedBgJson) {
    const choice = await openSmallWindow(
      "Import Backgrounds",
      "Existing bg.json files found that are not indexed. \nHow would you like to import them?",
      ["Import as New (Appear first)", "Import with Saved Date"]
    );
    importWithSavedDate = choice === "Import with Saved Date";
  }

  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      let indexedTime: number | undefined = Math.floor(Date.now() / 1000);
      const bgJsonPath = path.join(backgroundsDir, folderName, "bg.json");
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
          } else {
            // Use current time for "Import as New" or if no valid saved date
            await saveBgJsonFile({ id: folderName, localIndexed: indexedTime });
          }
        } catch (e) {
          logger.warn(
            `Could not read indexed value from ${bgJsonPath}, using current time. error: ${e}`
          );
          await saveBgJsonFile({ id: folderName, localIndexed: indexedTime });
        }
      }
      // In case saved time in bg.json is not valid or not found
      if (indexedTime === undefined) {
        indexedTime = Math.floor(Date.now() / 1000);
      }
      logger.info(
        `Adding new background: ${folderName}, indexed at ${indexedTime}`
      );
      backgroundsData.backgrounds[folderName] = indexedTime;
      updated = true;
    }
  }

  // Remove non-existent backgrounds
  for (const id of Object.keys(backgroundsData.backgrounds)) {
    if (!validIds.has(id)) {
      logger.info(`Removing non-existent background: ${id}`);
      delete backgroundsData.backgrounds[id];
      updated = true;
    }
  }

  // Build tag and name indexes
  const tagsIndex: Record<string, Set<string>> = {};
  const namesIndex: Record<string, Set<string>> = {};

  for (const id of Object.keys(backgroundsData.backgrounds)) {
    const bgJsonPath = path.join(backgroundsDir, id, "bg.json");
    try {
      if (fs.existsSync(bgJsonPath)) {
        const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
        const bg: BgJson = JSON.parse(rawBg);

        // Index tags
        if (bg.public?.tags && Array.isArray(bg.public.tags)) {
          for (const tag of bg.public.tags) {
            if (!tagsIndex[tag]) tagsIndex[tag] = new Set();
            tagsIndex[tag].add(id);
          }
        }

        // Index names
        if (bg.public?.name) {
          const name = bg.public.name;
          if (!namesIndex[name]) namesIndex[name] = new Set();
          namesIndex[name].add(id);
        }
      }
    } catch (e) {
      logger.warn(`Failed to index tags/names for ${id}:`, e);
    }
  }

  // Convert sets to arrays for JSON serialization
  backgroundsData.tags = {};
  for (const tag in tagsIndex) {
    backgroundsData.tags[tag] = Array.from(tagsIndex[tag]);
  }
  backgroundsData.names = {};
  for (const name in namesIndex) {
    backgroundsData.names[name] = Array.from(namesIndex[name]);
  }

  // Write back if updated or if tags/names changed
  backgroundsData.externalPaths = externalPaths;
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
    const bgJsonPath = await idToBgJson(summary.id);

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
      }
    }

    // Merge fields: use provided summary fields, otherwise fall back to oldBg, then default
    const publicData = {
      name: summary.name ?? oldBg.public?.name ?? "",
      bgFile: summary.bgFile ?? oldBg.public?.bgFile ?? "",
      icon: summary.iconPath
        ? path.basename(summary.iconPath)
        : (oldBg.public?.icon ?? ""),
      description: summary.description ?? oldBg.public?.description ?? "",
      tags: summary.tags ?? oldBg.public?.tags ?? [],
    };

    // Handle local.indexed logic
    const indexed: number | undefined =
      summary.localIndexed ??
      oldBg.local?.indexed ??
      Math.floor(Date.now() / 1000);

    const localData = {
      tags: summary.localTags ?? oldBg.local?.tags ?? [],
      indexed,
    };

    // Write merged bg.json
    const bgJson = {
      public: publicData,
      local: localData,
    };

    await fs.promises.writeFile(
      bgJsonPath,
      JSON.stringify(bgJson, null, 2),
      "utf-8"
    );
    logger.info(`Saved bg.json for background ${summary.id} at ${bgJsonPath}`);
    return true;
  } catch (error) {
    logger.error("Failed to save bg.json:", error);
    return false;
  }
}

/**
 * Helper to get an external path by index from backgrounds.json
 */
export async function getExternalPath(index: number) {
  const backgroundsJsonPath = getBackgroundsJsonFilePath();
  try {
    const raw = await fs.promises.readFile(backgroundsJsonPath, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.externalPaths) && data.externalPaths[index]) {
      return data.externalPaths[index];
    }
  } catch (e) {
    logger.warn("Failed to get externalPath from backgrounds.json:", e);
  }
  return null;
}

/**
 * Gets the background folder path for an ID.
 * Supports external backgrounds with id format ext::<num>::<folder>
 */
export const idToBackgroundFolder = async (id: string) => {
  const extMatch = id.match(/^ext::(\d+)::(.+)$/);
  if (extMatch) {
    const extIndex = Number(extMatch[1]);
    const folder = extMatch[2];
    const extBase = await getExternalPath(extIndex);
    if (extBase) {
      return path.join(extBase, folder);
    }
  }
  const baseDir = getBackgroundFilePath();
  const folderPath = id.includes("/") ? path.join(...id.split("/")) : id;
  return path.join(baseDir, folderPath);
};

/**
 * Gets the path of the bg.json file for an ID.
 * Supports external backgrounds.
 */
export const idToBgJson = async (id: string) => {
  const backgroundFolder = await idToBackgroundFolder(id);
  return path.join(backgroundFolder, "bg.json");
};

/**
 * Gets the actual background file for an ID.
 * Supports external backgrounds.
 * @param id The ID of the background.
 * @returns Direct FilePath of the background ("bgFile")
 */
export const idToBackgroundPath = async (id: string) => {
  try {
    const backgroundFolder = await idToBackgroundFolder(id);
    const bgJsonPath = await idToBgJson(id);
    if (!fs.existsSync(bgJsonPath)) return null;
    const rawBg = await fs.promises.readFile(bgJsonPath, "utf-8");
    const bg = JSON.parse(rawBg);
    if (bg.public && bg.public.bgFile) {
      return path.join(backgroundFolder, bg.public.bgFile);
    }
    return null;
  } catch (e) {
    logger.warn(`Failed to resolve filePath for id ${id}:`, e);
    return null;
  }
};

export async function filterBackgroundEntries(
  entries: [string, number][],
  search: string
): Promise<[string, number][]> {
  if (!search) {
    return entries;
  }

  const searchLower = search.toLowerCase();

  const [tagIndex, nameIndex] = await Promise.all([
    getTagIndex(),
    getNameIndex(),
  ]);

  // Collect all ids matching the search in tags or names
  const tagMatchedIds = Object.entries(tagIndex)
    .filter(([tag]) => tag.toLowerCase().includes(searchLower))
    .flatMap(([, ids]) => ids);

  const nameMatchedIds = Object.entries(nameIndex)
    .filter(([name]) => name.toLowerCase().includes(searchLower))
    .flatMap(([, ids]) => ids);

  const extraMatchedIds = new Set([...tagMatchedIds, ...nameMatchedIds]);

  return entries.filter(([id]) => {
    const idMatch = id.toLowerCase().includes(searchLower);
    return idMatch || extraMatchedIds.has(id);
  });
}

export const getBasePath = (): string => {
  return getAppDataPath();
};

export const getDesktopPath = (): string => {
  return path.join(getBasePath(), "desktop");
};

export const getDataFolderPath = (): string => {
  return path.join(getBasePath(), "data");
};

export const getLogsFolderPath = (): string => {
  return path.join(getBasePath(), "logs");
};

export const getDesktopIconsFilePath = (): string => {
  return path.join(getDesktopPath(), "desktopIcons.json");
};

export const getSettingsFilePath = (): string => {
  return path.join(getDesktopPath(), "settings.json");
};

export const getBackgroundFilePath = (): string => {
  return path.join(getBasePath(), "backgrounds");
};

export const getBackgroundsJsonFilePath = (): string => {
  return path.join(getBasePath(), "backgrounds.json");
};
