import { app, BrowserWindow, Menu, protocol } from "electron";
import { ensureAppDataFiles } from "./appDataSetup.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import { createLoggerForFile } from "./logging.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { registerSafeFileProtocol } from "./safeFileProtocol.js";
import { getSetting } from "./settings.js";
import { getActiveSubWindow } from "./subWindowManager.js";
import { createTray } from "./tray.js";
import { isDev } from "./util.js";
import { registerVideoFileProtocol } from "./videoFileProtocol.js";
import { handleWindowState, registerWindowKeybinds } from "./windowState.js";

const logger = createLoggerForFile("main.ts");

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

app.on("ready", () => {
  ensureAppDataFiles();
  logger.info("App is starting...");

  // Register our safe file protocol for loading icons.
  registerSafeFileProtocol("appdata-file");

  registerVideoFileProtocol("video-file");

  const mainWindow = new BrowserWindow({
    show: false,
    transparent: true, // Enables full transparency
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

  // Handle window state events
  handleWindowState(mainWindow);

  // Register global keybinds
  registerWindowKeybinds(mainWindow);

  registerIpcHandlers(mainWindow);

  createTray(mainWindow);
  handleCloseEvents(mainWindow);

  mainWindow.on("maximize", async () => {
    const headerType = await getSetting("headerType");
    if (headerType === "BORDERLESS") {
      mainWindow.setResizable(false);
    }
  });

  mainWindow.on("unmaximize", async () => {
    const headerType = await getSetting("headerType");
    if (headerType === "BORDERLESS") {
      mainWindow.setResizable(true);
    }
  });
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
