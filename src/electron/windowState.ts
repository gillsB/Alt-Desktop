import { BrowserWindow, globalShortcut } from "electron";
import { createLoggerForFile } from "./logging.js";
import {
  getActiveSubWindow,
  getSmallWindows,
} from "./windows/subWindowManager.js";

const logger = createLoggerForFile("windowState.ts");

export function handleWindowState(mainWindow: BrowserWindow) {
  mainWindow.on("minimize", () => {
    logger.info("Minimizing main window");
    mainWindow.webContents.send("window-visibility", "minimize");
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) activeSubWindow.hide();

    // Hide all small windows
    getSmallWindows().forEach((win) => {
      if (!win.isDestroyed()) win.hide();
    });
  });

  mainWindow.on("restore", () => {
    logger.info("Restoring main window");
    mainWindow.webContents.send("window-visibility", "restore");
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) activeSubWindow.show();

    // Show all small windows
    getSmallWindows().forEach((win) => {
      if (!win.isDestroyed()) win.show();
    });
  });

  mainWindow.on("hide", () => {
    logger.info("Hiding main window");
    mainWindow.webContents.send("window-visibility", "hide");
    // Save the window bounds before hiding it to the tray
    logger.info("Saved window bounds before hiding:");
  });
  mainWindow.on("show", () => {
    logger.info("Showing main window");
    mainWindow.webContents.send("window-visibility", "show");
  });
}

export function registerWindowKeybinds(mainWindow: BrowserWindow) {
  let isKeyPressed = false;

  const toggleOverlayKeybind = globalShortcut.register("Alt+D", () => {
    if (isKeyPressed) return;

    isKeyPressed = true;

    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      logger.info("Minimizing main window");
      mainWindow.minimize();
    } else {
      logger.info("Restoring main window");

      // Ensure the window is not minimized
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      } else if (!mainWindow.isVisible()) {
        // If the window is hidden (e.g., sent to the tray), show it
        mainWindow.show();
      }
    }

    // Reset the key state after a short delay to allow for key release
    setTimeout(() => {
      isKeyPressed = false;
    }, 50);
  });

  if (!toggleOverlayKeybind) {
    logger.error("Keybind binding failed");
  }
}
