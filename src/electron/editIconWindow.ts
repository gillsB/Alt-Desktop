import { BrowserWindow } from "electron";
import { DesktopIcon } from "./DesktopIcon.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { isDev } from "./util.js";

let editIconWindow: BrowserWindow | null = null;

export function openEditIconWindow(icon: DesktopIcon) {
  editIconWindow = new BrowserWindow({
    width: 260,
    height: 370,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
    title: "Edit Icon",
  });

  console.log(icon);

  if (isDev()) {
    editIconWindow.loadURL("http://localhost:5123/#/edit-icon");
  } else {
    editIconWindow.loadFile(getUIPath(), { hash: "edit-icon" });
  }

  editIconWindow.on("closed", () => {
    editIconWindow = null;
  });
}
