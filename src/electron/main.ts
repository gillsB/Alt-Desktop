import { app, BrowserWindow } from "electron";
import { ensureAppDataFiles } from "./appDataSetup.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { registerSafeFileProtocol } from "./safeFileProtocol.js";
import { createTray } from "./tray.js";
import { isDev } from "./util.js";

// This disables the menu completely. Must be done before "ready" or gets more complicated.
//Menu.setApplicationMenu(null);

app.on("ready", () => {
  // Ensure AppData directories exist before any chance to use them.
  ensureAppDataFiles();

  // Register our safe file protocol for loading icons.
  registerSafeFileProtocol("appdata-file");

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
  });
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.maximize();
  });

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
