import { indexBackgrounds } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow() {
  const options = {
    width: 850,
    height: 660,
    frame: false,
    minWidth: 645,
    minHeight: 450,
  };

  const subWindowHash = `background-select`;

  indexBackgrounds();
  return openSubWindow(options, subWindowHash, "Background Select");
}
