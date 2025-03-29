import { BrowserWindow } from "electron";
import { DesktopIcon } from "./DesktopIcon.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { isDev } from "./util.js";

let editIconWindow: BrowserWindow | null = null;

export function openEditIconWindow(icon: DesktopIcon) {
  editIconWindow = new BrowserWindow({
    width: 400,
    height: 460,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
    title: "Edit Icon",
  });

  console.log(icon);

  if (isDev()) {
    editIconWindow.loadURL(
      `http://localhost:5123/#/edit-icon?row=${icon.row}&col=${icon.col}`
    );
  } else {
    editIconWindow.loadFile(getUIPath(), {
      hash: `edit-icon?row=${icon.row}&col=${icon.col}`,
    });
  }

  editIconWindow.on("closed", () => {
    editIconWindow = null;
  });
}
