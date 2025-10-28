import { calculateSubWindowDimensions } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

// TODO most of this size copied from settings, so adjust when a style is setup for DesktopProfile.
export function openDesktopProfileWindow() {
  const defaultWidth = 600;
  const defaultHeight = 660;
  const minWidth = 465;
  const minHeight = 425;

  const { actualWidth: calculatedWidth, actualHeight: calculatedHeight } =
    calculateSubWindowDimensions(defaultWidth, defaultHeight);

  // Ensure dimensions are at least as large as the minimum
  const actualWidth = Math.max(calculatedWidth, minWidth);
  const actualHeight = Math.max(calculatedHeight, minHeight);

  const options = {
    width: actualWidth,
    height: actualHeight,
    frame: false,
    minWidth: minWidth,
    minHeight: minHeight,
  };

  const subWindowHash = `desktop-profile`;
  return openSubWindow(options, subWindowHash, "DesktopProfile");
}
