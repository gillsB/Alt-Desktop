import { indexBackgrounds } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow() {
  const options = {
    width: 800,
    height: 660,
    frame: false,
  };

  const subWindowHash = `background-select`;

  indexBackgrounds();
  return openSubWindow(options, subWindowHash, "Background Select");
}
