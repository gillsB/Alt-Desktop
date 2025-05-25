import { openSubWindow } from "./subWindowManager.js";
import { isDev, subWindowDevtoolsEnabled } from "./util.js";

export function openEditBackgroundWindow() {
  const options = {
    width: 600,
    height: 660,
    frame: false,
  };

  const subWindowHash = `edit-background`;
  const settingsWindow = openSubWindow(
    options,
    subWindowHash,
    "Edit Background"
  );

  if (isDev() && subWindowDevtoolsEnabled()) {
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  }
}
