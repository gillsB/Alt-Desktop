import { openSubWindow } from "./subWindowManager.js";

/**
 * Opens the EditBackground window for the given background summary.
 * @param {BackgroundSummary} summary
 * @returns {Electron.BrowserWindow}
 */
export function openEditBackground(summary: BackgroundSummary) {
  const options = {
    width: 910,
    height: 812,
    minWidth: 550,
    minHeight: 500,
    frame: false,
    resizable: true,
  };
  const hash = `edit-background?summary=${encodeURIComponent(JSON.stringify(summary))}`;
  return openSubWindow(options, hash, "Edit Background");
}
