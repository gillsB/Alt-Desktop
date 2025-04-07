import { BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import { createLoggerForFile } from "./logging.js";
import { getUIPath } from "./pathResolver.js";
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

export function createSubWindow(
  options: Electron.BrowserWindowConstructorOptions,
  subWindowHash: string
): BrowserWindow {
  // Properly close any existing subwindow
  closeActiveSubWindow();

  // Create a new subwindow
  activeSubWindow = new BrowserWindow(options);

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
