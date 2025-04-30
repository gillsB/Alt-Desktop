import { openSubWindow } from "./subWindowManager.js";
import { isDev, subWindowDevtoolsEnabled } from "./util.js";

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
