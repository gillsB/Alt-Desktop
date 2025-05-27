import {
  indexBackgrounds,
  isDev,
  subWindowDevtoolsEnabled,
} from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow() {
  const options = {
    width: 800,
    height: 660,
    frame: false,
  };

  const subWindowHash = `background-select`;
  const settingsWindow = openSubWindow(
    options,
    subWindowHash,
    "Background Select"
  );

  indexBackgrounds();

  if (isDev() && subWindowDevtoolsEnabled()) {
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  }
}
