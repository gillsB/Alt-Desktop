import { calculateSubWindowDimensions } from "../utils/util.js";
import { openSubWindow } from "./subWindowManager.js";

/**
 * Opens the EditBackground window for the given background summary.
 * @param {BackgroundSummary} summary
 * @returns {Electron.BrowserWindow}
 */
export function openEditBackground(summary: BackgroundSummary) {
  const defaultWidth = 910;
  const defaultHeight = 815;
  const minWidth = 550;
  const minHeight = 500;

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
  const hash = `edit-background?summary=${encodeURIComponent(JSON.stringify(summary))}`;
  return openSubWindow(options, hash, "Edit Background");
}
