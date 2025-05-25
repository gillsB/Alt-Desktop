import { isDev, subWindowDevtoolsEnabled } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(row: number, col: number) {
  const options = {
    width: 500,
    height: 660,
    frame: false,
  };

  const subWindowHash = `edit-icon?row=${row}&col=${col}`;
  const editWindow = openSubWindow(options, subWindowHash, "Edit Icon");

  if (isDev() && subWindowDevtoolsEnabled()) {
    editWindow.webContents.openDevTools({ mode: "detach" });
  }
}
