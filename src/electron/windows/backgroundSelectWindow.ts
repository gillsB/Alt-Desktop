import { BrowserWindow, screen } from "electron";
import { openSubWindow } from "./subWindowManager.js";

export function openBackgroundSelectWindow(id?: string) {
  // Get current display dimensions
  const currentDisplay = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  const { width: screenWidth, height: screenHeight } =
    currentDisplay.workAreaSize;

  // Check if current window is maximized
  const currentWindow = BrowserWindow.getFocusedWindow();
  const isMaximized = currentWindow?.isMaximized() || false;

  // Default dimensions (works well on 1080p+ screens both vertical and horizontal)
  const defaultWidth = 910;
  const defaultHeight = 815;

  const minWidth = 645;
  const minHeight = 450;
  const padding = 50;

  let actualWidth, actualHeight;

  if (isMaximized) {
    actualWidth = Math.min(defaultWidth, screenWidth - padding);
    actualHeight = Math.min(defaultHeight, screenHeight - padding);
  } else {
    // Scale based on window dimensions if not fullscreen
    const currentWindowBounds = currentWindow?.getBounds();
    if (currentWindowBounds) {
      const maxWidth = currentWindowBounds.width - padding;
      const maxHeight = currentWindowBounds.height - padding;
      actualWidth = Math.min(defaultWidth, maxWidth);
      actualHeight = Math.min(defaultHeight, maxHeight);
    } else {
      // Fallback to screen dimensions if window dimensions fail
      actualWidth = Math.min(defaultWidth, screenWidth - padding);
      actualHeight = Math.min(defaultHeight, screenHeight - padding);
    }
  }

  // Ensure dimensions are at least as large as the minimum
  actualWidth = Math.max(actualWidth, minWidth);
  actualHeight = Math.max(actualHeight, minHeight);

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
