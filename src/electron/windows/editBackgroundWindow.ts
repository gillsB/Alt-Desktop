import {
  indexBackgrounds,
  isDev,
  subWindowDevtoolsEnabled,
} from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openEditBackgroundWindow() {
  const options = {
    width: 800,
    height: 660,
    frame: false,
  };

  const subWindowHash = `edit-background`;
  const settingsWindow = openSubWindow(
    options,
    subWindowHash,
    "Edit Background"
  );

  indexBackgrounds();

  if (isDev() && subWindowDevtoolsEnabled()) {
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  }
}
