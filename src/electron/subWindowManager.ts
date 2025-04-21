import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import { createLoggerForFile } from "./logging.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { isDev } from "./util.js";

const logger = createLoggerForFile("subWindowManager.ts");
let mainWindow: BrowserWindow | null = null; // Store the main window reference

let activeSubWindow: BrowserWindow | null = null;
const smallMenuWindows: BrowserWindow[] = []; // Store multiple smallMenu windows
const allowedUrls: string[] = []; // Start with an empty list

// Add the main window URL to the allow-list
const mainWindowUrl = isDev()
  ? "http://localhost:5123"
  : pathToFileURL(getUIPath()).toString();
allowedUrls.push(mainWindowUrl);
logger.info(`Added main window URL to allowed list: ${mainWindowUrl}`);

/**
 * Opens a subwindow with the specified options and hash.
 *
 * @param {Electron.BrowserWindowConstructorOptions} options - The options for the subwindow.
 * @param {string} subWindowHash - The hash to append to the subwindow URL.
 * @param {string} [title="SubWindow"] - The title of the subwindow.
 */
export function openSubWindow(
  options: Electron.BrowserWindowConstructorOptions,
  subWindowHash: string,
  title: string = "SubWindow"
): BrowserWindow {
  // Properly close any existing subwindow
  closeActiveSubWindow();

  // Find the main window - get the first window if there's no specific "AltDesktop" titled window
  const allWindows = BrowserWindow.getAllWindows();
  mainWindow =
    allWindows.find((win) => win.title === "AltDesktop") ||
    (allWindows.length > 0 ? allWindows[0] : null);

  if (!mainWindow) {
    logger.error("No windows found when trying to create subwindow");
    throw new Error("No main window found");
  }

  logger.info(`Found main window with title: ${mainWindow.title}`);

  // Create a new subwindow
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
      ...options.webPreferences, // Allow overriding webPreferences
    },
  });

  // Generate the subwindow URL
  let subWindowUrl: string;
  if (isDev()) {
    subWindowUrl = `http://localhost:5123/#/${subWindowHash}`;
    activeSubWindow.loadURL(subWindowUrl);
  } else {
    subWindowUrl = pathToFileURL(getUIPath()).toString() + `#/${subWindowHash}`;
    activeSubWindow.loadFile(getUIPath(), { hash: subWindowHash });
  }

  // Add the subwindow URL to the allow-list
  addAllowedUrl(subWindowUrl);

  // Only show the window once it's ready to prevent flashing
  activeSubWindow.once("ready-to-show", () => {
    if (activeSubWindow) {
      activeSubWindow.show();
      activeSubWindow.focus();
    }
  });

  // Log the creation of the subwindow
  logger.info(`Created subwindow with URL: ${subWindowUrl}`);

  return activeSubWindow;
}

/**
 * Opens a small menu window with the specified options.
 *
 * @param {string} title - The title of the small menu.
 * @param {string} message - The message to display in the small menu.
 */
export function openSmallMenu(title: string, message: string): BrowserWindow {
  logger.info("Attempting to open a small menu...");

  // Find the main window
  const allWindows = BrowserWindow.getAllWindows();
  mainWindow =
    allWindows.find((win) => win.title === "AltDesktop") ||
    (allWindows.length > 0 ? allWindows[0] : null);

  if (!mainWindow) {
    logger.error("No windows found when trying to create small menu");
    throw new Error("No main window found");
  }

  logger.info(`Found main window with title: ${mainWindow.title}`);

  // Create a new small menu window
  const smallMenuWindow = new BrowserWindow({
    width: 400,
    height: 200,
    title: "Small Menu",
    parent: mainWindow,
    modal: true,
    resizable: false,
    frame: false,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
  });

  let smallMenuUrl: string;
  if (isDev()) {
    smallMenuUrl = `http://localhost:5123/#/small-menu?title=${encodeURIComponent(
      title
    )}&message=${encodeURIComponent(message)}`;
  } else {
    smallMenuUrl = `${pathToFileURL(getUIPath()).toString()}#/small-menu?title=${encodeURIComponent(
      title
    )}&message=${encodeURIComponent(message)}`;
  }

  logger.info(`Loading small menu URL: ${smallMenuUrl}`);
  smallMenuWindow.loadURL(smallMenuUrl);

  // Only show the window once it's ready to prevent flashing
  smallMenuWindow.once("ready-to-show", () => {
    logger.info("Small menu is ready to show");
    smallMenuWindow.show();
  });

  // Add the small menu window to the list
  smallMenuWindows.push(smallMenuWindow);

  // Handle window close
  smallMenuWindow.on("closed", () => {
    logger.info("Small menu window closed");
    const index = smallMenuWindows.indexOf(smallMenuWindow);
    if (index !== -1) {
      smallMenuWindows.splice(index, 1);
    }
  });

  logger.info(`Created small menu with title: ${title}`);
  return smallMenuWindow;
}

export function getActiveSubWindow(): BrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(): void {
  if (activeSubWindow) {
    mainWindow?.focus();
    // Get the URL of the active subwindow
    const subWindowUrl = activeSubWindow.webContents.getURL();
    logger.info(`Closing active subwindow with URL: ${subWindowUrl}`);

    // Remove the URL from the allowed list
    removeAllowedUrl(subWindowUrl);

    // To prevent flashing, hide the window first before closing it
    if (!activeSubWindow.isDestroyed()) {
      activeSubWindow.hide();

      // Use a small timeout to ensure the window is hidden before destroying
      setTimeout(() => {
        if (activeSubWindow && !activeSubWindow.isDestroyed()) {
          activeSubWindow.destroy(); // Use destroy instead of close for cleaner removal
        }
        activeSubWindow = null;
      }, 50);
    } else {
      activeSubWindow = null;
    }
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

export function getSmallMenuWindows(): BrowserWindow[] {
  return smallMenuWindows;
}
