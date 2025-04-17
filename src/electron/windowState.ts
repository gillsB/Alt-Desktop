import { BrowserWindow, globalShortcut } from "electron";
import { createLoggerForFile } from "./logging.js";
import { getActiveSubWindow } from "./subWindowManager.js";

const logger = createLoggerForFile("windowState.ts");

let lastBounds: Electron.Rectangle | null = null; // Store the last window bounds

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

  mainWindow.on("hide", () => {
    // Save the window bounds before hiding it to the tray
    lastBounds = mainWindow.getBounds();
    logger.info("Saved window bounds before hiding:", lastBounds);
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

      // If the window is hidden (e.g., sent to the tray), show it first
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      // Restore the window to its last bounds if available
      if (lastBounds) {
        logger.info("Restoring window to last bounds:", lastBounds);
        mainWindow.setBounds(lastBounds);
      }

      // Ensure the window is not minimized
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
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
