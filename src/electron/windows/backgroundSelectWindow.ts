import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow() {
  const options = {
    width: 910,
    height: 812,
    frame: false,
    minWidth: 645,
    minHeight: 450,
  };

  const subWindowHash = `background-select`;

  return openSubWindow(options, subWindowHash, "Background Select");
}
