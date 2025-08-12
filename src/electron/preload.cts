import electron, { webUtils } from "electron";

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
  getDesktopIconData: (profile?: string) =>
    ipcInvoke("getDesktopIconData", profile),
  getSafeFileUrl: (relativePath: string) => getSafeFileUrl(relativePath),
  ensureDataFolder: (id: string) => ipcInvoke("ensureDataFolder", id),
  ensureUniqueIconId: (name) => ipcInvoke("ensureUniqueIconId", name),
  setIconData: (icon) => ipcInvoke("setIconData", icon),
  sendSubWindowAction: (action, icon) =>
    ipcSend("sendSubWindowAction", { action, icon }),
  getDesktopIcon: (id: string, profile?: string) =>
    ipcInvoke("getDesktopIcon", id, profile),
  getSubWindowTitle: () => ipcInvoke("getSubWindowTitle"),
  reloadIcon: (id: string) => ipcInvoke("reloadIcon", id),
  openSettings: () => ipcInvoke("openSettings"),
  openBackgroundSelect: (id?: string) => ipcInvoke("openBackgroundSelect", id),
  editIcon: (id: string, row: number, col: number, profile?: string) =>
    ipcInvoke("editIcon", id, row, col, profile),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    electron.ipcRenderer.on(channel, callback);
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    electron.ipcRenderer.off(channel, callback);
  },
  reloadWindow: () => ipcInvoke("reloadWindow"),
  logMessage: (level: string, file: string, message: string) =>
    ipcInvoke("logMessage", level, file, message),
  logVideoMessage: (level: string, file: string, message: string) =>
    ipcInvoke("logVideoMessage", level, file, message),
  openFileDialog: (type: string, appDataFilePath?: string) =>
    ipcInvoke("openFileDialog", type, appDataFilePath),
  saveIconImage: (sourcePath: string, id: string) =>
    ipcInvoke("saveIconImage", sourcePath, id),
  saveToBackgroundIDFile: (id: string, sourcePath: string, saveFile: boolean) =>
    ipcInvoke("saveToBackgroundIDFile", id, sourcePath, saveFile),
  launchProgram: (id: string) => ipcInvoke("launchProgram", id),
  launchWebsite: (id: string) => ipcInvoke("launchWebsite", id),
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  getFileType: (filepath: string) => ipcInvoke("getFileType", filepath),
  deleteIcon: (id: string) => ipcInvoke("deleteIcon", id),
  openInExplorer: (
    type: "image" | "programLink" | "background",
    filePath: string
  ) => ipcInvoke("openInExplorer", type, filePath),
  showSmallWindow: (title: string, message: string, buttons: string[]) =>
    ipcInvoke("showSmallWindow", title, message, buttons),
  sendButtonResponse: (payload: {
    windowId: number;
    buttonText: string | null;
  }) => ipcSend("buttonResponse", payload),
  previewIconUpdate: (id: string, updates: Partial<DesktopIcon>) =>
    ipcInvoke("previewIconUpdate", id, updates),
  previewBackgroundUpdate: (updates: Partial<PreviewBackgroundUpdate>) =>
    ipcInvoke("previewBackgroundUpdate", updates),
  previewGridUpdate: (updates: Partial<SettingsData>) =>
    ipcInvoke("previewGridUpdate", updates),
  previewHeaderUpdate: (updates: Partial<SettingsData>) =>
    ipcInvoke("previewHeaderUpdate", updates),
  getSettingsData: () => ipcInvoke("getSettingsData"),
  saveSettingsData: (data: SettingsData) => ipcInvoke("saveSettingsData", data),
  getSetting: <T extends SettingKey>(key: T): Promise<SettingsData[T]> =>
    ipcInvoke("getSetting", key) as Promise<SettingsData[T]>,
  convertToVideoFileUrl: (filePath) =>
    ipcInvoke("convertToVideoFileUrl", filePath),
  getBackgroundImagePath: (filePath) =>
    ipcInvoke("getBackgroundImagePath", filePath),
  reloadBackground: () => ipcInvoke("reloadBackground"),
  reloadGrid: () => ipcInvoke("reloadGrid"),
  reloadHeader: () => ipcInvoke("reloadHeader"),
  getVideoMetadata: (filePath: string): Promise<VideoMetadata> =>
    ipcInvoke("getVideoMetadata", filePath),
  generateIcon: (id: string, programLink: string, webLink: string) =>
    ipcInvoke("generateIcon", id, programLink, webLink),
  selectIconFromList: (
    title: string,
    images: string[],
    id: string,
    row: number,
    col: number
  ) => ipcInvoke("selectIconFromList", title, images, id, row, col),
  resetAllIconsFontColor: () => ipcInvoke("resetAllIconsFontColor"),
  getBackgroundIDs: () => ipcInvoke("getBackgroundIDs"),
  getBackgroundSummaries: (params) =>
    ipcInvoke("getBackgroundSummaries", params),
  getBackgroundPageForId: (params) =>
    ipcInvoke("getBackgroundPageForId", params),
  resolveShortcut: (filePath: string) => ipcInvoke("resolveShortcut", filePath),
  openEditBackground: (summary: BackgroundSummary) =>
    ipcInvoke("openEditBackground", summary),
  getBgJson: (id: string) => ipcInvoke("getBgJson", id),
  saveBgJson: (summary: BackgroundSummary) => ipcInvoke("saveBgJson", summary),
  deleteBackground: (id: string) => ipcInvoke("deleteBackground", id),
  addLocalTag: (tag: LocalTag) => ipcInvoke("addLocalTag", tag),
  updateLocalTag: (name: string, tag: LocalTag) =>
    ipcInvoke("updateLocalTag", name, tag),
  deleteLocalTag: (name: string) => ipcInvoke("deleteLocalTag", name),
  getLocalCategories: () => ipcInvoke("getLocalCategories"),
  renameCategory: (oldName: string, newName: string) =>
    ipcInvoke("renameCategory", oldName, newName),
  deleteCategory: (name: string) => ipcInvoke("deleteCategory", name),
  renameLocalTag: (oldName: string, newName: string) =>
    ipcInvoke("renameLocalTag", oldName, newName),
  indexBackgrounds: (options?: { newExternalPathAdded?: boolean }) =>
    ipcInvoke("indexBackgrounds", options),
  changeBackgroundDirectory: (id: string, targetLocation: string) =>
    ipcInvoke("changeBackgroundDirectory", id, targetLocation),
  getBaseFilePaths: (name?: string) => ipcInvoke("getBaseFilePaths", name),
  setRendererStates: (updates: Partial<RendererStates>) =>
    ipcInvoke("setRendererStates", updates),
  getRendererStates: () => ipcInvoke("getRendererStates"),
  getInfoFromID: <K extends InfoKey>(id: string, type: K) =>
    ipcInvoke("getInfoFromID", id, type) as Promise<IDInfo[K] | null>,
  getInfoFromBgPath: <K extends PathKey>(path: string, type: K) =>
    ipcInvoke("getInfoFromBgPath", path, type) as Promise<PathInfo[K] | null>,
  renameDataFolder: (oldFolder: string, newFolder: string) =>
    ipcInvoke("renameDataFolder", oldFolder, newFolder),
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
