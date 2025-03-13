import { BrowserWindow, Menu } from "electron";
import { ipcWebContentsSend, isDev } from "./util.js";

export function createMenu(mainWindow: BrowserWindow) {
  // If not isDev() return and do not create a menu
  /*
    if (!isDev()){
        Menu.setApplicationMenu(null);
        return;
    }
    */

  //**********************************************
  // All of the below is technically invalidated as
  // It has swapped to a frameless window.
  // This was more so for learning how to use, not for full
  // implementation.
  //  */

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        // MacOS by default names the first menu tab the same name as the source file.
        label: process.platform === "darwin" ? undefined : "Dev",
        type: "submenu",
        submenu: [
          {
            label: "DevTools",
            click: () => mainWindow.webContents.openDevTools(),
            visible: isDev(),
          },
        ],
      },
      {
        label: "View",
        type: "submenu",
        submenu: [
          {
            label: "CPU",
            click: () =>
              ipcWebContentsSend("changeView", mainWindow.webContents, "CPU"),
          },
          {
            label: "RAM",
            click: () =>
              ipcWebContentsSend("changeView", mainWindow.webContents, "RAM"),
          },
          {
            label: "STORAGE",
            click: () =>
              ipcWebContentsSend(
                "changeView",
                mainWindow.webContents,
                "STORAGE"
              ),
          },
        ],
      },
    ])
  );
}
