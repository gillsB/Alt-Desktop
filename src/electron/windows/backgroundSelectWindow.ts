import { calculateSubWindowDimensions } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow(id?: string) {
  // Default dimensions (works well on 1080p+ screens both vertical and horizontal)
  const defaultWidth = 910;
  const defaultHeight = 815;

  const minWidth = 645;
  const minHeight = 450;
  const { actualWidth: calculatedWidth, actualHeight: calculatedHeight } =
    calculateSubWindowDimensions(defaultWidth, defaultHeight);

  // Ensure dimensions are at least as large as the minimum
  const actualWidth = Math.max(calculatedWidth, minWidth);
  const actualHeight = Math.max(calculatedHeight, minHeight);

  const options = {
    width: actualWidth,
    height: actualHeight,
    frame: false,
    minWidth,
    minHeight,
  };

  const subWindowHash = id ? `background-select?id=${id}` : "background-select";

  return openSubWindow(options, subWindowHash, "Background Select");
}
