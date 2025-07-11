import { screen } from "electron";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow(id?: string) {
  // Get current display dimensions
  const currentDisplay = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  const { width: screenWidth, height: screenHeight } =
    currentDisplay.workAreaSize;

  // Default dimensions (works well on 1080p+ screens both vertical and horizontal)
  const defaultWidth = 910;
  const defaultHeight = 815;

  const padding = 50;
  const actualWidth = Math.min(defaultWidth, screenWidth - padding);
  const actualHeight = Math.min(defaultHeight, screenHeight - padding);

  const options = {
    width: actualWidth,
    height: actualHeight,
    frame: false,
    minWidth: 645,
    minHeight: 450,
  };

  const subWindowHash = id ? `background-select?id=${id}` : "background-select";

  return openSubWindow(options, subWindowHash, "Background Select");
}
