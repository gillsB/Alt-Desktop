import { openSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(row: number, col: number) {
  const options = {
    width: 400,
    height: 460,
    frame: false,
  };

  const subWindowHash = `edit-icon?row=${row}&col=${col}`;
  openSubWindow(options, subWindowHash, "Edit Icon");
}
