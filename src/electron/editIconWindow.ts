import { DesktopIcon } from "./DesktopIcon.js";
import { getPreloadPath } from "./pathResolver.js";
import { createSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(icon: DesktopIcon) {
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

  const subWindowHash = `edit-icon?row=${icon.row}&col=${icon.col}`;
  createSubWindow(options, subWindowHash);
}
