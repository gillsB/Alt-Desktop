import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { createTray } from "./tray.js";
import { ipcMainHandle, ipcMainOn, isDev } from "./util.js";

// This disables the menu completely. Must be done before "ready" or gets more complicated.
//Menu.setApplicationMenu(null);

app.on("ready", () => {
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
    const appDataPath = process.env.APPDATA;

    if (!appDataPath) {
      throw new Error("APPDATA environment variable is not set.");
    }

    const directoryPath = path.join(appDataPath, "AltDesktop", "desktop");
    const filePath = path.join(directoryPath, "desktopIcons.json");

    console.log("Resolved File Path:", filePath);

    try {
      // Ensure directory exists
      if (!fs.existsSync(directoryPath)) {
        console.log("Directory does not exist, creating:", directoryPath);
        fs.mkdirSync(directoryPath, { recursive: true });
        console.log("Directory created successfully.");
      } else {
        console.log("Directory already exists:", directoryPath);
      }

      // Ensure file exists
      if (!fs.existsSync(filePath)) {
        console.log("File does not exist, creating:", filePath);
        const defaultData: DesktopIconData = { icons: [] };
        fs.writeFileSync(
          filePath,
          JSON.stringify(defaultData, null, 2),
          "utf-8"
        );
        console.log("File created successfully.");
      } else {
        console.log("File already exists:", filePath);
      }

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
