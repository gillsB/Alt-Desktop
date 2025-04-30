import { openSubWindow } from "./subWindowManager.js";

export function openSettingsWindow() {
  const options = {
    width: 500,
    height: 660,
    frame: false,
  };

  const subWindowHash = `settings`;
  const settingsWindow = openSubWindow(options, subWindowHash, "Settings");

  //settingsWindow.webContents.openDevTools({ mode: "detach" });
}
