import { openSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(id: string, row: number, col: number) {
  const options = {
    width: 500,
    height: 660,
    frame: false,
    minWidth: 360,
    minHeight: 580,
  };

  const subWindowHash = `edit-icon?id=${encodeURIComponent(id)}&row=${row}&col=${col}`;
  return openSubWindow(options, subWindowHash, "EditIcon");
}
