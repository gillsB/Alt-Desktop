import { openSubWindow } from "./subWindowManager.js";
import { isDev, subWindowDevtoolsEnabled } from "./util.js";

export function openSettingsWindow() {
  const options = {
    width: 600,
    height: 660,
    frame: false,
  };

  const subWindowHash = `settings`;
  const settingsWindow = openSubWindow(options, subWindowHash, "Settings");

  if (isDev() && subWindowDevtoolsEnabled()) {
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  }
}
