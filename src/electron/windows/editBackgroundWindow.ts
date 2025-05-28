import { openSubWindow } from "./subWindowManager.js";
/**
 * Opens the EditBackground window for the given file path.
 * @param {string} filePath
 * @returns {Electron.BrowserWindow}
 */
export function openEditBackground(filePath: string) {
  const options = {
    width: 600,
    height: 400,
    frame: false,
    resizable: true,
  };
  const hash = `edit-background?filePath=${encodeURIComponent(filePath)}`;
  return openSubWindow(options, hash, "Edit Background");
}
