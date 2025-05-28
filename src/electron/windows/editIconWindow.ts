import { openSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(row: number, col: number) {
  const options = {
    width: 500,
    height: 660,
    frame: false,
  };

  const subWindowHash = `edit-icon?row=${row}&col=${col}`;
  return openSubWindow(options, subWindowHash, "Edit Icon");
}
