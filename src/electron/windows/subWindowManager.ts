import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import { createLoggerForFile } from "../logging.js";
import { getPreloadPath, getUIPath } from "../pathResolver.js";
import {
  isDev,
  smallWindowDevtoolsEnabled,
  subWindowDevtoolsEnabled,
} from "../utils/util.js";

const logger = createLoggerForFile("subWindowManager.ts");
let mainWindow: BrowserWindow | null = null; // Store the main window reference

let activeSubWindow: CustomBrowserWindow | null = null;
const smallWindows: BrowserWindow[] = []; // Store multiple small windows
const allowedUrls: string[] = []; // Start with an empty list

// Map to track pending small window responses
export const pendingSmallWindowResponses = new Map<
  number,
  {
    resolve: (value: string) => void;
    reject: (reason: unknown) => void;
  }
>();

// Add the main window URL to the allow-list
const mainWindowUrl = isDev()
  ? "http://localhost:5123"
  : pathToFileURL(getUIPath()).toString();
allowedUrls.push(mainWindowUrl);
logger.info(`Added main window URL to allowed list: ${mainWindowUrl}`);

/**
 * Opens a subwindow with the specified options and hash.
 * If a subwindow is already open, it will be closed first, and the new subwindow will be created
 * only after the previous one is fully destroyed. Only allow calling this when closing the current
 * subWindow is fine by you.
 *
 * @param {Electron.BrowserWindowConstructorOptions} options - The options for the subwindow.
 * @param {string} subWindowHash - The hash to append to the subwindow URL.
 * @param {string} [title="SubWindow"] - The title of the subwindow.
 * @returns {BrowserWindow | null} The created BrowserWindow instance,
 * or null if another subwindow was open and is being closed (the new window will be created asynchronously).
 *
 */

export function openSubWindow(
  options: Electron.BrowserWindowConstructorOptions,
  subWindowHash: string,
  title: string = "SubWindow"
): BrowserWindow | null {
  // Helper to actually create the window
  const createWindow = () => {
    // Find the main window
    const allWindows = BrowserWindow.getAllWindows();
    mainWindow =
      allWindows.find(
        (activeSubWindow) => activeSubWindow.title === "AltDesktop"
      ) || (allWindows.length > 0 ? allWindows[0] : null);

    if (!mainWindow) {
      logger.error("No windows found when trying to create subwindow");
      throw new Error("No main window found");
    }

    activeSubWindow = new BrowserWindow({
      ...options,
      title, // Set the title of the subwindow
      parent: mainWindow, // Set the parent to the main window
      modal: false,
      skipTaskbar: true, // Hide the subwindow from the taskbar
      backgroundColor: "#00000000", // Fully transparent this must be set or windows will flash white on restore.
      show: false, // Don't show the window initially to prevent flashing
      webPreferences: {
        preload: getPreloadPath(),
        webSecurity: true,
        ...options.webPreferences,
      },
    }) as CustomBrowserWindow;
    activeSubWindow.customTitle = title;

    // Generate the subwindow URL
    let subWindowUrl: string;
    if (isDev()) {
      subWindowUrl = `http://localhost:5123/#/${subWindowHash}`;
      activeSubWindow.loadURL(subWindowUrl);
    } else {
      subWindowUrl =
        pathToFileURL(getUIPath()).toString() + `#/${subWindowHash}`;
      activeSubWindow.loadFile(getUIPath(), { hash: subWindowHash });
    }

    addAllowedUrl(subWindowUrl);

    activeSubWindow.once("ready-to-show", () => {
      // Add 200ms delay before showing the window
      setTimeout(() => {
        activeSubWindow!.show();
        activeSubWindow!.focus();
        if (isDev() && subWindowDevtoolsEnabled()) {
          activeSubWindow?.webContents.openDevTools({ mode: "detach" });
        }
      }, 200);
    });

    logger.info(`Created subwindow with URL: ${subWindowUrl}`);

    return activeSubWindow;
  };

  // If there is an active subwindow, close it and wait for it to be destroyed before creating the new one
  if (activeSubWindow) {
    closeActiveSubWindow(() => {
      createWindow();
    });
    // Return null for now, but subWindow will be created.
    return null;
  } else {
    return createWindow();
  }
}

/**
 * Opens a small window with the specified options and returns a promise that resolves with the string of the clicked button.
 *
 * @param {string} title - The title of the small window.
 * @param {string} message - The message to display in the small window.
 * @param {string[]} [buttons=["Okay"]] - The buttons to display in the small window.
 * @returns {Promise<string>} A promise that resolves with the button text that was clicked.
 */
export function showSmallWindow(
  title: string,
  message: string,
  buttons: string[] = ["Okay"],
  closeable: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Find the main window
      const allWindows = BrowserWindow.getAllWindows();
      mainWindow =
        allWindows.find((win) => win.title === "AltDesktop") ||
        (allWindows.length > 0 ? allWindows[0] : null);

      if (!mainWindow) {
        logger.error("No windows found when trying to create small window");
        reject(new Error("No main window found"));
        return;
      }

      // Create a new small window
      const smallWindow = new BrowserWindow({
        width: 400,
        height: 350,
        title: "Small Window",
        parent: mainWindow,
        modal: false,
        resizable: true,
        frame: false,
        backgroundColor: "#00000000",
        show: false,
        webPreferences: {
          preload: getPreloadPath(),
          webSecurity: true,
        },
      });

      // Store the promise callbacks in the map with the window ID as the key
      pendingSmallWindowResponses.set(smallWindow.id, { resolve, reject });

      // Encode the buttons array and windowId as query parameters
      const encodedButtons = encodeURIComponent(JSON.stringify(buttons));
      const windowId = smallWindow.id;

      let smallWindowUrl: string;
      if (isDev()) {
        smallWindowUrl = `http://localhost:5123/#/small-window?title=${encodeURIComponent(
          title
        )}&message=${encodeURIComponent(message)}&buttons=${encodedButtons}&windowId=${windowId}&closeable=${closeable}`;
      } else {
        smallWindowUrl = `${pathToFileURL(getUIPath()).toString()}#/small-window?title=${encodeURIComponent(
          title
        )}&message=${encodeURIComponent(message)}&buttons=${encodedButtons}&windowId=${windowId}&closeable=${closeable}`;
      }

      logger.info(`Loading small window URL: ${smallWindowUrl}`);
      smallWindow.loadURL(smallWindowUrl);

      // Only show the window once it's ready to prevent flashing
      smallWindow.once("ready-to-show", () => {
        smallWindow.show();
      });

      // Add the small window to the list
      smallWindows.push(smallWindow);

      // Handle window close without a button click
      smallWindow.on("closed", () => {
        logger.info("Small window closed");
        const index = smallWindows.indexOf(smallWindow);
        if (index !== -1) {
          smallWindows.splice(index, 1);
        }

        // If we still have a pending response for this window, resolve with default value
        if (pendingSmallWindowResponses.has(smallWindow.id)) {
          const pendingResponse = pendingSmallWindowResponses.get(
            smallWindow.id
          );
          pendingSmallWindowResponses.delete(smallWindow.id);

          if (pendingResponse) {
            pendingResponse.resolve(buttons[0] || "");
          }
        }
      });

      if (isDev() && smallWindowDevtoolsEnabled()) {
        smallWindow.webContents.openDevTools({ mode: "detach" });
      }

      logger.info(`Created small window with title: ${title}`);
    } catch (error) {
      logger.error(`Error opening small window: ${error}`);
      reject(error);
    }
  });
}

/**
 * Opens a select icon window with the specified options and returns a promise that resolves with the selected icon.
 *
 * @param {string} title - The title of the select icon window.
 * @param {string[]} images - The list of image URLs to display in the window.
 * @param {number} row - The number of rows to arrange the images.
 * @param {number} col - The number of columns to arrange the images.
 * @returns {Promise<string>} A promise that resolves with the selected icon URL.
 */
export function openSelectIconWindow(
  title: string,
  images: string[],
  id: string,
  row: number,
  col: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Find the main window
      const allWindows = BrowserWindow.getAllWindows();
      mainWindow =
        allWindows.find((win) => win.title === "AltDesktop") ||
        (allWindows.length > 0 ? allWindows[0] : null);

      if (!mainWindow) {
        logger.error(
          "No windows found when trying to create select icon window"
        );
        reject(new Error("No main window found"));
        return;
      }

      // Create a new select icon window
      const selectWindow = new BrowserWindow({
        width: 420,
        height: 350,
        title: "Select Icon",
        parent: mainWindow,
        modal: false,
        resizable: false,
        frame: false,
        backgroundColor: "#00000000",
        show: false,
        webPreferences: {
          preload: getPreloadPath(),
          webSecurity: true,
        },
      });

      // Store the promise callbacks in the map with the window ID as the key
      pendingSmallWindowResponses.set(selectWindow.id, { resolve, reject });

      // Encode the images array and windowId as query parameters
      const encodedImages = encodeURIComponent(JSON.stringify(images));
      const encodedId = encodeURIComponent(id);
      const windowId = selectWindow.id;

      let selectWindowUrl: string;
      if (isDev()) {
        selectWindowUrl = `http://localhost:5123/#/select-icon?title=${encodeURIComponent(
          title
        )}&images=${encodedImages}&id=${encodedId}&row=${row}&col=${col}&windowId=${windowId}`;
      } else {
        selectWindowUrl = `${pathToFileURL(getUIPath()).toString()}#/select-icon?title=${encodeURIComponent(
          title
        )}&images=${encodedImages}&id=${encodedId}&row=${row}&col=${col}&windowId=${windowId}`;
      }

      logger.info(`Loading select icon window URL: ${selectWindowUrl}`);
      selectWindow.loadURL(selectWindowUrl);

      // Only show the window once it's ready to prevent flashing
      selectWindow.once("ready-to-show", () => {
        selectWindow.show();
      });

      // Handle window close without a selection
      selectWindow.on("closed", () => {
        logger.info("Select icon window closed");
        if (pendingSmallWindowResponses.has(selectWindow.id)) {
          const pendingResponse = pendingSmallWindowResponses.get(
            selectWindow.id
          );
          pendingSmallWindowResponses.delete(selectWindow.id);
          if (pendingResponse) {
            pendingResponse.resolve(""); // No selection
          }
        }
      });

      if (isDev() && smallWindowDevtoolsEnabled()) {
        selectWindow.webContents.openDevTools({ mode: "detach" });
      }
    } catch (error) {
      logger.error(`Error opening select icon window: ${error}`);
      reject(error);
    }
  });
}

export function getActiveSubWindow(): CustomBrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(onClosed?: () => void): void {
  if (activeSubWindow) {
    mainWindow?.focus();
    const subWindowUrl = activeSubWindow.webContents.getURL();
    logger.info(`Closing active subwindow with URL: ${subWindowUrl}`);
    removeAllowedUrl(subWindowUrl);

    if (!activeSubWindow.isDestroyed()) {
      activeSubWindow.hide();

      // Listen for the 'closed' event to ensure the window is fully destroyed
      activeSubWindow.once("closed", () => {
        activeSubWindow = null;
        if (onClosed) onClosed();
      });

      setTimeout(() => {
        if (activeSubWindow && !activeSubWindow.isDestroyed()) {
          activeSubWindow.destroy();
        }
        // If the window was already destroyed in the meantime, call the callback
        // (the 'closed' event will not fire if already destroyed)
        if (activeSubWindow === null && onClosed) onClosed();
      }, 50);
    } else {
      activeSubWindow = null;
      if (onClosed) onClosed();
    }
  } else if (onClosed) {
    onClosed();
  }
}
export function addAllowedUrl(url: string): void {
  if (!allowedUrls.includes(url)) {
    allowedUrls.push(url);
    logger.info(`Added allowed URL: ${url}`);
  }
}

export function removeAllowedUrl(url: string): void {
  const index = allowedUrls.indexOf(url);
  if (index !== -1) {
    allowedUrls.splice(index, 1);
    logger.info(`Removed allowed URL: ${url}`);
  }
}

export function getAllowedUrls(): string[] {
  return allowedUrls;
}

export function getSmallWindows(): BrowserWindow[] {
  return smallWindows;
}
