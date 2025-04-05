import { getPreloadPath } from "./pathResolver.js";
import { createSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(row: number, col: number) {
  const options = {
    width: 400,
    height: 460,
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
