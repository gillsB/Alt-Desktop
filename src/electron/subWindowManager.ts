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
  // Close any existing subwindow
  if (activeSubWindow) {
    activeSubWindow.removeAllListeners("closed");
    activeSubWindow.close();
  }

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

  // When the subwindow is closed, clear the reference
  activeSubWindow.on("closed", () => {
    activeSubWindow = null;
  });

  return activeSubWindow;
}

export function getActiveSubWindow(): BrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(): void {
  if (activeSubWindow) {
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

export function getAllowedUrls(): string[] {
  return allowedUrls;
}
