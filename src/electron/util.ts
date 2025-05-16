import { ipcMain, shell, WebContents, WebFrameMain } from "electron";
import fs from "fs";
import path from "path";
import { createLoggerForFile } from "./logging.js";
import { getAllowedUrls } from "./subWindowManager.js";

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

  logger.info(
    `frame URL: ${frame.url} Allowed URLs: ${JSON.stringify(allowedUrls)}`
  );

  if (!allowedUrls.some((url) => frame.url.startsWith(url))) {
    logger.error(`Malicious event from unknown source: ${frame.url}`);
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
    } else {
      logger.info("File already exists:", filePath);
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
 * Escapes special characters in a string for use in a regular expression.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
