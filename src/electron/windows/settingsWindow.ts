import { openSubWindow } from "./subWindowManager.js";

export function openSettingsWindow() {
  const options = {
    width: 600,
    height: 660,
    frame: false,
  };

  const subWindowHash = `settings`;
  return openSubWindow(options, subWindowHash, "Settings");
}
