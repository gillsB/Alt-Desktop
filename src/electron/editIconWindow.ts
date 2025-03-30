import { DesktopIcon } from "./DesktopIcon.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { createSubWindow } from "./subWindowManager.js";
import { isDev } from "./util.js";

export function openEditIconWindow(icon: DesktopIcon) {
  const editIconWindow = createSubWindow({
    width: 400,
    height: 460,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: true,
    },
    frame: false,
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
}
