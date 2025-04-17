import { BrowserWindow, globalShortcut } from "electron";
import { createLoggerForFile } from "./logging.js";
import { getActiveSubWindow } from "./subWindowManager.js";

const logger = createLoggerForFile("windowState.ts");

export function handleWindowState(mainWindow: BrowserWindow) {
  mainWindow.on("minimize", () => {
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) {
      activeSubWindow.hide(); // Minimizing the subWindow adds a goofy animation. so .hide()
    }
  });

  mainWindow.on("restore", () => {
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) {
      activeSubWindow.show(); // Restoring the subWindow adds a goofy animation. so .show()
    }
  });
}

export function registerWindowKeybinds(mainWindow: BrowserWindow) {
  let isKeyPressed = false;

  const toggleOverlayKeybind = globalShortcut.register("Alt+D", () => {
    if (isKeyPressed) return;

    isKeyPressed = true;

    if (mainWindow.isMinimized()) {
      logger.info("Restoring main window");
      mainWindow.restore();
    } else {
      logger.info("Minimizing main window");
      mainWindow.minimize();
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
