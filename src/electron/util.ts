import { ipcMain, WebContents, WebFrameMain } from "electron";
import fs from "fs";
import { pathToFileURL } from "url";
import { getUIPath } from "./pathResolver.js";

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
/** JSDoc
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

/** JSDoc
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

/** JSDoc
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
  if (isDev() && new URL(frame.url).host === "localhost:5123") {
    return;
  }
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
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
      console.error(
        "Error: file does not exist, When it should, fallback creating:",
        filePath
      );
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
      console.log("File created successfully.");
    } else {
      console.log("File already exists:", filePath);
    }
    return true;
  } catch (error) {
    console.error("Failed to create file:", filePath, error);
    return false;
  }
};
