import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { ensureAppDataFiles, getAppDataPath } from "./appDataSetup.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { registerSafeFileProtocol } from "./safeFileProtocol.js";
import { createTray } from "./tray.js";
import { ensureFileExists, ipcMainHandle, ipcMainOn, isDev } from "./util.js";

// This disables the menu completely. Must be done before "ready" or gets more complicated.
//Menu.setApplicationMenu(null);

app.on("ready", () => {
  // Ensure AppData directories exist before any chance to use them.
  ensureAppDataFiles();

  // Register our safe file protocol for loading icons.
  registerSafeFileProtocol("appdata-file");

  const mainWindow = new BrowserWindow({
    show: false,
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

  ipcMainHandle("getDesktopIconData", async (): Promise<DesktopIconData> => {
    const directoryPath = path.join(getAppDataPath(), "desktop");
    const filePath = path.join(directoryPath, "desktopIcons.json");

    console.log("Resolved File Path:", filePath);

    try {
      // Read JSON file
      const data = fs.readFileSync(filePath, "utf-8");
      console.log("Read file contents:", data);
      const parsedData: DesktopIconData = JSON.parse(data);

      // Convert image paths to use the appdata-file protocol
      if (parsedData.icons) {
        parsedData.icons = parsedData.icons.map((icon) => {
          // Only convert paths that are local and don't already use our protocol
          if (
            icon.image &&
            !icon.image.startsWith("http") &&
            !icon.image.startsWith("appdata-file://")
          ) {
            // Determine if it's a relative path to icons folder
            if (!path.isAbsolute(icon.image) && !icon.image.includes("://")) {
              console.log("falls into here", icon.image);
              // TODO this does not currently return a valid path.
              // instead of a valid path it only returns valid if "/icons/image.png"
              // interestingly this requests URL: "appdata-file://icons/icons/image.png" and works...
              return {
                ...icon,
                image: `appdata-file://${icon.image}`,
              };
            }
          }
          console.log(icon.image);
          return icon;
        });
      }

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

  ipcMainHandle(
    "ensureDataFolder",
    async (row: number, col: number): Promise<boolean> => {
      try {
        const basePath = getAppDataPath();
        const dataFolderPath = path.join(basePath, "data");
        const fullPath = path.join(dataFolderPath, `[${row}, ${col}]`);

        if (!fs.existsSync(fullPath)) {
          console.log(
            `Data folder [${row}, ${col}] does not exist, creating:`,
            fullPath
          );
          fs.mkdirSync(fullPath, { recursive: true });
          console.log(`Data folder [${row}, ${col}] created successfully.`);
        } else {
          console.log(`Data folder [${row}, ${col}] already exists:`, fullPath);
        }

        // Ensure Data file exists
        return ensureFileExists(fullPath, { icons: [] });
      } catch (error) {
        console.error(`Error ensuring Data folder [${row}, ${col}]:`, error);
        return false;
      }
    }
  );

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
