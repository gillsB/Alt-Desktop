import { ipcMain, WebContents, WebFrameMain } from "electron";
import { pathToFileURL } from "url";
import { getUIPath } from "./pathResolver.js";

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
/** JSDoc
 * Registers an IPC event handler for the specified key.
 *
 * This function wraps `ipcMain.handle` to enforce validation and support both synchronous
 * and asynchronous handlers.
 *
 * @template Key - A key of `EventPayloadMapping`, representing the IPC event name.
 * @param {Key} key - The name of the IPC event to handle.
 * @param {() => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>} handler -
 *        A function that returns the event payload, supporting both synchronous and asynchronous responses.
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
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: () => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]> // Support both sync & async
) {
  ipcMain.handle(key, async (event) => {
    // Async function ensures async support
    if (!event.senderFrame) {
      throw new Error("Event sender frame is null");
    }
    validateEventFrame(event.senderFrame);
    return handler(); // Works for both sync and async functions
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
