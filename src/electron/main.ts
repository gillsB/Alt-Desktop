import { app, BrowserWindow, globalShortcut, Menu } from "electron";
import { ensureAppDataFiles } from "./appDataSetup.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import { createLoggerForFile } from "./logging.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { registerSafeFileProtocol } from "./safeFileProtocol.js";
import { getActiveSubWindow } from "./subWindowManager.js";
import { createTray } from "./tray.js";
import { isDev } from "./util.js";

const logger = createLoggerForFile("main.ts");

// This disables the menu completely for all windows (including the sub windows).
Menu.setApplicationMenu(null);

app.on("ready", () => {
  ensureAppDataFiles();
  logger.info("App is starting...");

  // Register our safe file protocol for loading icons.
  registerSafeFileProtocol("appdata-file");

  app.commandLine.appendSwitch("enable-transparent-visuals");
  const mainWindow = new BrowserWindow({
    show: false,
    transparent: true, // Enables full transparency
    backgroundColor: "#00000000", // Ensures no default background color
    hasShadow: false,
    webPreferences: {
      // preload function to allow only specific functions to communicate with from the ui.
      preload: getPreloadPath(),
      webSecurity: true, //default is True, but to be sure it remains such.
    },
    frame: false,
    title: "AltDesktop",
  });
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  mainWindow.once("ready-to-show", () => {
    logger.info("Main window is ready to show");
    mainWindow.show();
    mainWindow.maximize();
  });

  // Synchronize minimize/restore actions with the subwindow
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

  const toggleOverlayKeybind = globalShortcut.register("Alt+D", () => {
    if (mainWindow.isMinimized()) {
      logger.info("Restoring main window");
      mainWindow.restore();
    } else {
      logger.info("Minimizing main window");
      mainWindow.minimize();
    }
  });

  if (!toggleOverlayKeybind) {
    logger.error("Keybind binding failed");
  }

  registerIpcHandlers(mainWindow);

  createTray(mainWindow);
  handleCloseEvents(mainWindow);
});

function handleCloseEvents(mainWindow: BrowserWindow) {
  let willClose = false;

  mainWindow.on("close", (e) => {
    if (willClose) {
      // if we tell it to close just return (full close).
      return;
    }
    // else hide to tray.
    e.preventDefault();
    mainWindow.hide();
    //mac os hide taskbar
    if (app.dock) {
      app.dock.hide();
    }
  });
  app.on("before-quit", () => {
    willClose = true;
  });

  mainWindow.on("show", () => {
    willClose = false;
  });
}
