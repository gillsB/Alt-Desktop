import { BrowserWindow } from "electron";
import { getPreloadPath } from "./pathResolver.js";
import { createSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(row: number, col: number) {
  const mainWindow = BrowserWindow.getAllWindows().find(
    (win) => win.title === "AltDesktop"
  );

  const options = {
    width: 400,
    height: 460,
    parent: mainWindow || undefined, // Set the parent to the main window
    modal: true, // Make the subwindow modal
    skipTaskbar: true, // Hide the subwindow from the taskbar
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
    frame: false,
    title: "Edit Icon",
  };

  const subWindowHash = `edit-icon?row=${row}&col=${col}`;
  createSubWindow(options, subWindowHash);
}
