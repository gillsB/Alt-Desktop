import { app, BrowserWindow, Menu, protocol } from "electron";
import { ensureAppDataFiles } from "./appDataSetup.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import { createLoggerForFile } from "./logging.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { registerSafeFileProtocol } from "./safeFileProtocol.js";
import { getSetting } from "./settings.js";
import { createTray } from "./tray.js";
import { initializeRendererStatesProfile } from "./utils/rendererStates.js";
import { initializeThemeManager } from "./utils/themeManager.js";
import { indexBackgrounds, isDev, setMainWindow } from "./utils/util.js";
import { registerVideoFileProtocol } from "./videoFileProtocol.js";
import { getActiveSubWindow } from "./windows/subWindowManager.js";
import { handleWindowState, registerWindowKeybinds } from "./windowState.js";

const logger = createLoggerForFile("main.ts");

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", { reason, promise });
});

// This disables the menu completely for all windows (including the sub windows).
Menu.setApplicationMenu(null);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "video-file",
    privileges: {
      bypassCSP: true,
      stream: true,
    },
  },
]);

app.commandLine.appendSwitch("enable-transparent-visuals");
app.commandLine.appendSwitch("enable-features", "PlatformHEVCDecoderSupport");

app.on("ready", async () => {
  ensureAppDataFiles();
  logger.info("App is starting...");

  await initializeThemeManager();

  // Register our safe file protocol for loading icons.
  registerSafeFileProtocol("appdata-file");

  registerVideoFileProtocol("video-file");

  const transparency = getSetting("windowType") === "BORDERLESS" ? true : false;

  const mainWindow = new BrowserWindow({
    show: false,
    transparent: transparency,
    backgroundColor: "#00000000", // Ensures no default background color
    hasShadow: false,
    webPreferences: {
      // preload function to allow only specific functions to communicate with from the ui.
      preload: getPreloadPath(),
      webSecurity: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    title: "AltDesktop",
    minHeight: 600,
    minWidth: 550,
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

  setMainWindow(mainWindow);

  // Handle window state events
  handleWindowState(mainWindow);

  // Register global keybinds
  registerWindowKeybinds(mainWindow);

  registerIpcHandlers(mainWindow);

  createTray(mainWindow);
  handleCloseEvents(mainWindow);

  indexBackgrounds();
  initializeRendererStatesProfile();

  mainWindow.on("maximize", async () => {
    const windowType = await getSetting("windowType");
    if (windowType === "BORDERLESS") {
      mainWindow.setResizable(false);
    }
    mainWindow.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", async () => {
    const windowType = await getSetting("windowType");
    if (windowType === "BORDERLESS") {
      mainWindow.setResizable(true);
    }
    mainWindow.webContents.send("window-unmaximized");
  });

  //mainWindow.webContents.openDevTools();
});

function handleCloseEvents(mainWindow: BrowserWindow) {
  let willClose = false;

  mainWindow.on("close", (e) => {
    if (willClose) {
      // If we tell it to close, just return (full close).
      return;
    }

    // Else hide to tray.
    e.preventDefault();
    mainWindow.hide();

    // Hide the active subwindow as well
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) {
      activeSubWindow.hide();
      logger.info("Active subwindow hidden due to closing mainWindow.");
    }

    // macOS: hide taskbar
    if (app.dock) {
      app.dock.hide();
    }
  });

  app.on("before-quit", () => {
    willClose = true;
  });

  mainWindow.on("show", () => {
    willClose = false;

    // Show the active subwindow when the main window is restored
    const activeSubWindow = getActiveSubWindow();
    if (activeSubWindow) {
      activeSubWindow.show();
      logger.info("Active subwindow shown along with main window.");
    }
  });
}
