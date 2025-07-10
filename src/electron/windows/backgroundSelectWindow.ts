import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow(id?: string) {
  const options = {
    width: 910,
    height: 815,
    frame: false,
    minWidth: 645,
    minHeight: 450,
  };

  const subWindowHash = id ? `background-select?id=${id}` : "background-select";

  return openSubWindow(options, subWindowHash, "Background Select");
}
