import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { ensureAppDataFiles, getAppDataPath } from "./filesetup.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { createTray } from "./tray.js";
import { ipcMainHandle, ipcMainOn, isDev } from "./util.js";

// This disables the menu completely. Must be done before "ready" or gets more complicated.
//Menu.setApplicationMenu(null);

app.on("ready", () => {
  // Ensure AppData directories exist before any chance to use them.
  ensureAppDataFiles();
  const mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      // preload function to allow only specific functions to communicate with from the ui.
      preload: getPreloadPath(),
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

  pollResources(mainWindow);

  ipcMainHandle("getStaticData", () => {
    return getStaticData();
  });

  ipcMainHandle("getDesktopIconData", async (): Promise<DesktopIconData> => {
    const directoryPath = path.join(getAppDataPath(), "desktop");
    const filePath = path.join(directoryPath, "desktopIcons.json");

    console.log("Resolved File Path:", filePath);

    try {
      // Read JSON file
      const data = fs.readFileSync(filePath, "utf-8");
      console.log("Read file contents:", data);
      const parsedData: DesktopIconData = JSON.parse(data);

      return parsedData;
    } catch (error) {
      console.error("Error reading or creating JSON file:", error);
      return { icons: [] }; // Return default if error
    }
  });

  ipcMainOn("sendHeaderAction", (payload) => {
    switch (payload) {
      case "MINIMIZE":
        mainWindow.minimize();
        break;
      case "MAXIMIZE":
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case "CLOSE":
        mainWindow.close();
        break;
      case "SHOW_DEVTOOLS":
        mainWindow.webContents.openDevTools();
        break;
    }
  });

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
