import { openSubWindow } from "./subWindowManager.js";

export function openEditIconWindow(
  id: string,
  row: number,
  col: number,
  profile?: string
) {
  const options = {
    width: 500,
    height: 660,
    frame: false,
  };

  const subWindowHash = `edit-icon?id=${encodeURIComponent(id)}&row=${row}&col=${col}&profile=${encodeURIComponent(profile || "")}`;
  return openSubWindow(options, subWindowHash, "Edit Icon");
}
