import { app, BrowserWindow, screen } from "electron";
import { createMenu } from "./menu.js";
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

  mainWindow.webContents.once("did-finish-load", async () => {
    // Wait a bit to ensure layout is settled
    setTimeout(async () => {
      const { width, height } = await mainWindow.webContents.executeJavaScript(`
        (function() {
          const rect = document.documentElement.getBoundingClientRect();
          return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
        })();
      `);

      // Ensure window doesn't exceed screen size
      const { width: maxWidth, height: maxHeight } =
        screen.getPrimaryDisplay().workAreaSize;
      const newWidth = Math.min(width, maxWidth);
      const newHeight = Math.min(height, maxHeight);

      mainWindow.setSize(newWidth, newHeight);
      mainWindow.show(); // Show after resizing
    }, 100); // Small delay to ensure layout settles
  });

  pollResources(mainWindow);

  ipcMainHandle("getStaticData", () => {
    return getStaticData();
  });

  ipcMainOn("sendFrameAction", (payload) => {
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
  createMenu(mainWindow);
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
