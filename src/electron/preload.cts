import electron, { ipcRenderer, webUtils } from "electron";

interface DesktopIcon {
  row: number;
  col: number;
  name: string;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  image: string;
  programLink?: string;
  args?: string[];
  websiteLink?: string;
  fontColor?: string;
  fontSize?: number;
}

// builds the bridge for communicating with ui
electron.contextBridge.exposeInMainWorld("electron", {
  ...window.electron,
  subscribeStatistics: (callback) =>
    ipcOn("statistics", (stats) => {
      callback(stats);
    }),
  subscribeChangeView: (callback) =>
    ipcOn("changeView", (view) => {
      callback(view);
    }),
  getStaticData: () => ipcInvoke("getStaticData"),
  sendHeaderAction: (payload) => ipcSend("sendHeaderAction", payload),
  getDesktopIconData: () => ipcInvoke("getDesktopIconData"),
  getSafeFileUrl: (relativePath: string) => getSafeFileUrl(relativePath),
  ensureDataFolder: (row: number, col: number) =>
    ipcInvoke("ensureDataFolder", row, col),
  setIconData: (icon) => ipcInvoke("setIconData", icon),
  sendSubWindowAction: (action, icon) =>
    ipcSend("sendSubWindowAction", { action, icon }),
  getDesktopIcon: (row, col) => ipcInvoke("getDesktopIcon", row, col),
  isSubWindowActive: () => ipcInvoke("isSubWindowActive"),
  reloadIcon: (row, col) => ipcInvoke("reloadIcon", row, col),
  openSettings: () => ipcInvoke("openSettings"),
  editIcon: (row, col) => ipcInvoke("editIcon", row, col),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    electron.ipcRenderer.on(channel, callback);
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    electron.ipcRenderer.off(channel, callback);
  },
  reloadWindow: () => ipcInvoke("reloadWindow"),
  logMessage: (level: string, file: string, message: string) => {
    ipcRenderer.send("logMessage", { level, file, message });
  },
  logVideoMessage: (level: string, file: string, message: string) => {
    ipcRenderer.send("logVideoMessage", { level, file, message });
  },
  openFileDialog: (type: string, appDataFilePath?: string) =>
    ipcInvoke("openFileDialog", type, appDataFilePath),
  saveIconImage: (sourcePath: string, row: number, col: number) =>
    ipcInvoke("saveIconImage", sourcePath, row, col),
  saveBackgroundImage: (sourcePath: string) =>
    ipcInvoke("saveBackgroundImage", sourcePath),
  launchProgram: (row: number, col: number) =>
    ipcInvoke("launchProgram", row, col),
  launchWebsite: (row: number, col: number) =>
    ipcInvoke("launchWebsite", row, col),
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  getFileType: (filepath: string) => ipcInvoke("getFileType", filepath),
  deleteIcon: (row: number, col: number) => ipcInvoke("deleteIcon", row, col),
  openInExplorer: (type: "image" | "programLink", filePath: string) =>
    ipcInvoke("openInExplorer", type, filePath),
  showSmallWindow: (title: string, message: string, buttons: string[]) =>
    ipcInvoke("showSmallWindow", title, message, buttons),
  sendButtonResponse: (payload: {
    windowId: number;
    buttonText: string | null;
  }) => ipcSend("buttonResponse", payload),
  previewIconUpdate: (
    row: number,
    col: number,
    updates: Partial<DesktopIcon>
  ) => ipcInvoke("previewIconUpdate", row, col, updates),
  previewBackgroundUpdate: (updates: Partial<SettingsData>) =>
    ipcInvoke("previewBackgroundUpdate", updates),
  getSettingsData: () => ipcInvoke("getSettingsData"),
  saveSettingsData: (data: SettingsData) => ipcInvoke("saveSettingsData", data),
  getSetting: <T extends SettingKey>(key: T): Promise<SettingsData[T]> =>
    ipcInvoke("getSetting", key) as Promise<SettingsData[T]>,
  convertToVideoFileUrl: (filePath) =>
    ipcInvoke("convertToVideoFileUrl", filePath),
  getBackgroundImagePath: (filePath) =>
    ipcInvoke("getBackgroundImagePath", filePath),
  reloadBackground: () => ipcInvoke("reloadBackground"),
  getVideoMetadata: (filePath: string): Promise<VideoMetadata> =>
    ipcInvoke("getVideoMetadata", filePath),
} satisfies Window["electron"]);

function ipcInvoke<Key extends keyof EventPayloadMapping>(
  key: Key,
  ...args: Key extends keyof EventParamMapping ? EventParamMapping[Key] : []
): Promise<EventPayloadMapping[Key]> {
  return electron.ipcRenderer.invoke(key, ...args);
}
function ipcOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  callback: (payload: EventPayloadMapping[Key]) => void
) {
  const cb = (
    _: Electron.IpcRendererEvent,
    payload: EventPayloadMapping[Key]
  ) => callback(payload);
  electron.ipcRenderer.on(key, cb);
  return () => electron.ipcRenderer.off(key, cb);
}

function ipcSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  payload: EventPayloadMapping[Key]
) {
  electron.ipcRenderer.send(key, payload);
}

function getSafeFileUrl(relativePath: string): string {
  // Normalize path separators and ensure no leading slash
  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  return `appdata-file://${normalizedPath}`;
}
