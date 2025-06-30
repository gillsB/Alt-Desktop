import {
  BrowserWindow,
  ipcMain,
  shell,
  WebContents,
  WebFrameMain,
} from "electron";
import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import { createLoggerForFile } from "../logging.js";
import { PUBLIC_TAG_CATEGORIES } from "../publicTags.js";
import { getSetting } from "../settings.js";
import {
  getAllowedUrls,
  openSmallWindow,
} from "../windows/subWindowManager.js";

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
export async function indexBackgrounds(options?: {
  newExternalPathAdded?: boolean;
}) {
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
  let importWithSavedDate = false; // Default to "Import as New"

  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      foundUnindexedBgJson = true;
    }
  }

  // Only prompt if unindexed bg.jsons found and newExternalPathAdded is true
  if (foundUnindexedBgJson && options?.newExternalPathAdded) {
    const choice = await openSmallWindow(
      "Import Backgrounds",
      "Existing bg.json files found that are not indexed. \nHow would you like to import them?",
      ["Import as New (Appear first)", "Import with Saved Date"]
    );
    importWithSavedDate = choice === "Import with Saved Date";
  }

  const newIds: string[] = [];
  const newBgIndexedTimes: Record<string, number> = {};
  for (const folderName of validIds) {
    if (!(folderName in backgroundsData.backgrounds)) {
      newIds.push(folderName);
      let indexedTime: number | undefined = Math.floor(Date.now() / 1000);
      const bgJsonPath = await idToBgJson(folderName);
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

  // Find suspected moves
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
      newBaseId = newBaseId.replace(/_\d+$/, "");

      for (const removedId of removedIdMap.keys()) {
        let baseId = removedId;
        const extMatch = removedId.match(/^ext::\d+::(.+)$/);
        if (extMatch) {
          baseId = extMatch[1];
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
        const newBgJsonPath = await idToBgJson(newId);
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
    const bgJsonPath = await idToBgJson(id);
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
  logger.info(
    `Indexed ${newIds.length} new background(s), removed ${removedIds.length} background(s).`
  );
  logger.info("Finished indexing");
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
    if (!fs.existsSync(bgJsonPath)) {
      logger.warn(`bg.json not found at ${bgJsonPath}`);
      return null;
    }
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

export const getBasePath = (): string => {
  return getAppDataPath();
};

export const getDataFolderPath = (): string => {
  return path.join(getBasePath(), "data");
};

export const getLogsFolderPath = (): string => {
  return path.join(getBasePath(), "logs");
};

export const getDesktopIconsFilePath = (): string => {
  return path.join(getBasePath(), "desktopIcons.json");
};

export const getSettingsFilePath = (): string => {
  return path.join(getBasePath(), "settings.json");
};

export const getBackgroundFilePath = (): string => {
  return path.join(getBasePath(), "backgrounds");
};

export const getBackgroundsJsonFilePath = (): string => {
  return path.join(getBasePath(), "backgrounds.json");
};

// Helper: concurrency-limited promise pool
export async function promisePool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
) {
  const executing: Promise<void>[] = [];
  let i = 0;

  async function enqueue() {
    if (i >= items.length) return;
    const item = items[i++];
    const p = fn(item).then(() => {
      // Remove this promise from executing when done
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length < limit) {
      await enqueue();
    }
  }

  // Start initial batch
  await Promise.all(Array(Math.min(limit, items.length)).fill(0).map(enqueue));
  // Wait for all to finish
  await Promise.all(executing);
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
    // Determine source folder and baseId
    let baseId = id;
    let sourceDir: string;
    let sourceExtIndex: number | null = null;

    const extMatch = id.match(/^ext::(\d+)::(.+)$/);
    if (extMatch) {
      sourceExtIndex = Number(extMatch[1]);
      baseId = extMatch[2];
      const extBase = await getExternalPath(sourceExtIndex);
      if (!extBase)
        throw new Error(`External path ${sourceExtIndex} not found`);
      sourceDir = path.join(extBase, baseId);
    } else {
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
        await fsExtra.remove(sourceDir);
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
