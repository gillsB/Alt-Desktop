import { openSubWindow } from "./subWindowManager.js";

/**
 * Opens the EditBackground window for the given background summary.
 * @param {BackgroundSummary} summary
 * @returns {Electron.BrowserWindow}
 */
export function openEditBackground(summary: BackgroundSummary) {
  const options = {
    width: 700,
    height: 800,
    frame: false,
    resizable: true,
  };
  const hash = `edit-background?summary=${encodeURIComponent(JSON.stringify(summary))}`;
  return openSubWindow(options, hash, "Edit Background");
}
