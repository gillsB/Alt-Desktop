import { BrowserWindow } from "electron";

let activeSubWindow: BrowserWindow | null = null;

export function createSubWindow(
  options: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  // Close any existing subwindow
  if (activeSubWindow) {
    activeSubWindow.removeAllListeners("closed");
    activeSubWindow.close();
  }

  // Create a new subwindow
  activeSubWindow = new BrowserWindow(options);

  // When the subwindow is closed, clear the reference
  activeSubWindow.on("closed", () => {
    // Only clear the reference if this is still the active subwindow
    if (activeSubWindow === BrowserWindow.getFocusedWindow()) {
      activeSubWindow = null;
    }
  });

  return activeSubWindow;
}

export function getActiveSubWindow(): BrowserWindow | null {
  return activeSubWindow;
}

export function closeActiveSubWindow(): void {
  if (activeSubWindow) {
    activeSubWindow.removeAllListeners("closed");
    activeSubWindow.close();
    activeSubWindow = null;
  }
}
