import { openSubWindow } from "./subWindowManager.js";

export function openSettingsWindow() {
  const options = {
    width: 500,
    height: 660,
    frame: false,
  };

  const subWindowHash = `settings`;
  openSubWindow(options, subWindowHash, "Settings");
}
