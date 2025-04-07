import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import { createLoggerForFile } from "./logging.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { isDev } from "./util.js";

const logger = createLoggerForFile("subWindowManager.ts");

let activeSubWindow: BrowserWindow | null = null;
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

  // Create a new subwindow
  activeSubWindow = new BrowserWindow({
    ...options,
    title, // Set the title of the subwindow
    parent:
      BrowserWindow.getAllWindows().find((win) => win.title === "AltDesktop") ||
      undefined, // Set the parent to the main window
    modal: true, // Make the subwindow modal
    skipTaskbar: true, // Hide the subwindow from the taskbar
    alwaysOnTop: true, // Ensure the subwindow is always on top
    backgroundColor: "#00000000", // Fully transparent this must be set or windows will flash white on restore.
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

  // Log the creation of the subwindow
  logger.info(`Created subwindow with URL: ${subWindowUrl}`);

  return activeSubWindow;
}

export function getActiveSubWindow(): BrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(): void {
  if (activeSubWindow) {
    // Get the URL of the active subwindow
    const subWindowUrl = activeSubWindow.webContents.getURL();
    logger.info(`Closing active subwindow with URL: ${subWindowUrl}`);

    // Remove the URL from the allowed list
    removeAllowedUrl(subWindowUrl);

    // Remove all listeners and close the subwindow
    activeSubWindow.removeAllListeners("closed");
    activeSubWindow.close();
    activeSubWindow = null;
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
