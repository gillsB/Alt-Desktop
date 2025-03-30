import { BrowserWindow } from "electron";

let activeSubWindow: BrowserWindow | null = null;

export function createSubWindow(
  options: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  // Close any existing subwindow
  if (activeSubWindow) {
    activeSubWindow.close();
  }

  // Create a new subwindow
  activeSubWindow = new BrowserWindow(options);

  // When the subwindow is closed, clear the reference
  activeSubWindow.on("closed", () => {
    activeSubWindow = null;
  });

  return activeSubWindow;
}

export function getActiveSubWindow(): BrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(): void {
  if (activeSubWindow) {
    activeSubWindow.close();
    activeSubWindow = null;
  }
}
