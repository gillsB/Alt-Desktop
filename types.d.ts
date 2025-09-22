// These 3 are inactive (originally used in ElectronResources repository).
// Originally used as a reference for creating ipc calls.
// Might use them in the future though so their types are still here.
type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageUsage: number;
};
type StaticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};
type View = "CPU" | "RAM" | "STORAGE";

type HeaderAction =
  | "MINIMIZE"
  | "MAXIMIZE"
  | "CLOSE"
  | "SHOW_DEVTOOLS"
  | "ENABLE_SUBWINDOW_DEVTOOLS"
  | "DISABLE_SUBWINDOW_DEVTOOLS"
  | "ENABLE_SMALLWINDOW_DEVTOOLS"
  | "DISABLE_SMALLWINDOW_DEVTOOLS";

type SubWindowAction = "EDIT_ICON" | "CLOSE_SUBWINDOW";

type WindowType = "WINDOWED" | "BORDERLESS";

type BgJson = {
  public?: {
    name?: string;
    bgFile?: string;
    icon?: string;
    description?: string;
    tags?: string[];
  };
  local?: {
    profile?: string;
    volume?: number;
    tags?: string[];
    indexed?: number;
  };
};

type PreviewBackgroundUpdate = {
  id?: string;
  volume?: number;
  profile?: string;
};

type IDInfo = {
  bgJsonFilePath?: string;
  bgJson?: BgJson;
  folderPath?: string; // base folder path (contains bg.json, icon, background/lnk etc.)
  fileType?: "image" | "video";
  name?: string;
  backgroundPath?: string;
  iconPath?: string;
  description?: string;
  tags?: string[];
  localVolume?: number;
  volume?: number; // same as localVolume
  localTags?: string[];
  localIndexed?: number;
  indexed?: number; // same as localIndexed
};

type InfoKey = keyof IDInfo;

type PathInfo = {
  name?: string;
  resolution?: [number, number] | null;
};

type PathKey = keyof PathInfo;

interface BackgroundsData {
  backgrounds: Record<string, number>;
  tags?: Record<string, string[]>;
  names?: Record<string, string[]>;
}

type DesktopIconData = {
  icons: DesktopIcon[];
};

type LocalTag = {
  name: string;
  category: string;
  favorite: boolean;
};

type SettingsData = {
  externalPaths?: string[];
  defaultIconSize?: number;
  defaultFontSize?: number;
  defaultFontColor?: string;
  windowType?: WindowType;
  // Do not appear in Settings window yet.
  defaultBackgroundPath?: string;
  // Do not appear in Settings window
  background?: string;
  newBackgroundID?: number;
  bgSelectIconSize?: "tiny" | "small" | "medium" | "large" | "massive";
  publicCategories?: Record<string, boolean>;
  localCategories?: Record<string, boolean>;
  localTags?: LocalTag[];
};

type SettingKey = keyof SettingsData;

type BackgroundSummary = {
  id: string;
  name?: string;
  description?: string;
  iconPath?: string;
  bgFile?: string;
  tags?: string[];
  localProfile?: string;
  localVolume?: number;
  localTags?: string[];
  localIndexed?: number;
};

type GetBackgroundSummariesRequest = {
  offset?: number;
  limit?: number;
  search?: string;
  includeTags?: string[];
  excludeTags?: string[];
};

type GetBackgroundSummariesResponse = {
  results: BackgroundSummary[];
  total: number;
};

type GetBackgroundPageForIdRequest = {
  id: string;
  pageSize?: number;
  search?: string;
  includeTags?: string[];
  excludeTags?: string[];
};

type GetBackgroundPageForIdResponse = {
  page: number; // -1 if not found
  summary?: BackgroundSummary;
};

type DesktopIcon = {
  id: string;
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
  launchDefault: "program" | "website";
};

interface ContextMenu {
  x: number;
  y: number;
  type: "desktop" | "iconBox" | "icon" | "hideIcons";
  icon?: DesktopIcon | null;
}

type VideoMetadata = {
  format: {
    filename: string;
    duration: number; // Duration in seconds
    size: number; // File size in bytes
    bit_rate: number; // Bitrate in bits per second
    format_name: string; // Format name (e.g., "mp4")
    format_long_name: string; // Full format name
  };
  streams: Array<{
    codec_name: string; // Codec name (e.g., "h264")
    codec_type: "video" | "audio"; // Stream type
    codec_tag_string?: string; // Codec tag string (e.g., "hvc1")
    codec_tag?: string; // Codec tag (e.g., "0x31637668")
    width?: number; // Video width (if applicable)
    height?: number; // Video height (if applicable)
    duration?: number; // Stream duration in seconds
    bit_rate?: number; // Stream bitrate in bits per second
    sample_rate?: number; // Audio sample rate (if applicable)
    channels?: number; // Number of audio channels (if applicable)
  }>;
};

interface BackgroundFileProgressEvent {
  progress: number;
  done: boolean;
}

interface CustomBrowserWindow extends Electron.BrowserWindow {
  customTitle?: string;
}

type RendererStates = {
  showVideoControls?: boolean;
  hideIcons?: boolean;
  hideIconNames?: boolean;
  profile?: string;
};

// Items/objects being sent from the renderer to the main process
interface EventParamMapping {
  statistics: [];
  getStaticData: [];
  changeView: [];
  sendHeaderAction: [HeaderAction];
  getDesktopIconData: [profile?: string];
  ensureProfileFolder: [string, copyFromProfile?: string];
  ensureDataFolder: [string];
  ensureUniqueIconId: [string];
  saveIconData: [DesktopIcon];
  renameID: [string, string];
  sendSubWindowAction: [SubWindowAction, DesktopIcon?];
  getDesktopIcon: [string];
  reloadIcon: [string];
  openSettings: [];
  editIcon: [string, number, number];
  reloadWindow: [];
  logMessage: [string, string, string];
  logVideoMessage: [string, string, string];
  openFileDialog: [string, string?];
  saveIconImage: [string, string];
  saveToBackgroundIDFile: [string, string, boolean];
  launchProgram: [string];
  launchWebsite: [string];
  getFilePath: [File];
  getFileType: [string];
  deleteIcon: [string];
  deleteIconData: [string];
  openInExplorer: ["image" | "programLink" | "background", string];
  showSmallWindow: [string, string, string[]];
  previewIconUpdate: [string, Partial<DesktopIcon>];
  previewBackgroundUpdate: [Partial<PreviewBackgroundUpdate>];
  previewGridUpdate: [Partial<SettingsData>];
  previewHeaderUpdate: [Partial<SettingsData>];
  getSubWindowTitle: [];
  getSettingsData: [];
  saveSettingsData: [SettingsData];
  getSetting: [SettingKey];
  convertToVideoFileUrl: [string];
  getBackgroundImagePath: [string];
  reloadBackground: [];
  reloadGrid: [];
  reloadHeader: [];
  getVideoMetadata: [string];
  generateIcon: [string, string, string];
  selectIconFromList: [string, string[], string, number, number];
  resetAllIconsFontColor: [];
  openBackgroundSelect: [id?: string];
  getBackgroundIDs: [];
  getBackgroundSummaries: [GetBackgroundSummariesRequest?];
  getBackgroundPageForId: [GetBackgroundPageForIdRequest];
  resolveShortcut: [string];
  openEditBackground: [BackgroundSummary];
  getBgJson: [string];
  saveBgJson: [BackgroundSummary];
  deleteBackground: [string];
  addLocalTag: [LocalTag];
  updateLocalTag: [string, LocalTag];
  deleteLocalTag: [string];
  getLocalCategories: [];
  renameCategory: [string, string];
  deleteCategory: [string];
  renameLocalTag: [string, string];
  indexBackgrounds: [
    options?: { newExternalPathAdded?: boolean; newDefaultPathAdded?: boolean },
  ];
  changeBackgroundDirectory: [string, string];
  getBaseFilePaths: [name?: string];
  setRendererStates: [Partial<RendererStates>];
  getRendererStates: [];
  getInfoFromID: [string, InfoKey];
  getInfoFromBgPath: [string, PathKey];
  renameDataFolder: [string, string];
  getProfiles: [];
  moveDesktopIcon: [string, number, number, offsetReset?: boolean];
  swapDesktopIcons: [string, string];
  editIconOffsetUpdate: [number, number];
}

// The returns from the main process to the renderer
type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  changeView: View;
  sendHeaderAction: HeaderAction;
  getDesktopIconData: DesktopIconData;
  ensureProfileFolder: boolean;
  ensureDataFolder: boolean;
  ensureUniqueIconId: string | null;
  saveIconData: boolean;
  renameID: boolean;
  sendSubWindowAction: {
    action: SubWindowAction;
    title: string;
  };
  getDesktopIcon: DesktopIcon | null;
  reloadIcon: boolean;
  openSettings: boolean;
  editIcon: boolean;
  reloadWindow: boolean;
  logMessage: boolean;
  logVideoMessage: boolean;
  openFileDialog: string | null;
  saveIconImage: string;
  saveToBackgroundIDFile: string;
  launchProgram: boolean;
  launchWebsite: boolean;
  getFilePath: string;
  getFileType: string;
  deleteIcon: boolean;
  deleteIconData: boolean;
  openInExplorer: boolean;
  showSmallWindow: string;
  buttonResponse: { windowId: number; buttonText: string | null };
  previewIconUpdate: boolean;
  previewBackgroundUpdate: boolean;
  previewHeaderUpdate: boolean;
  previewGridUpdate: boolean;
  getSubWindowTitle: string;
  getSettingsData: SettingsData;
  saveSettingsData: boolean;
  getSetting: SettingsData[SettingKey];
  convertToVideoFileUrl: string | null;
  getBackgroundImagePath: string | null;
  reloadBackground: boolean;
  reloadGrid: boolean;
  reloadHeader: boolean;
  getVideoMetadata: VideoMetadata;
  generateIcon: string[];
  selectIconFromList: string;
  resetAllIconsFontColor: boolean;
  openBackgroundSelect: boolean;
  getBackgroundIDs: string[];
  getBackgroundSummaries: GetBackgroundSummariesResponse;
  getBackgroundPageForId: GetBackgroundPageForIdResponse;
  resolveShortcut: string;
  openEditBackground: boolean;
  getBgJson: BgJson | null;
  saveBgJson: boolean;
  deleteBackground: boolean;
  addLocalTag: boolean;
  updateLocalTag: boolean;
  deleteLocalTag: boolean;
  getLocalCategories: string[];
  renameCategory: boolean;
  deleteCategory: boolean;
  renameLocalTag: boolean;
  indexBackgrounds: [number, number];
  changeBackgroundDirectory: string | null;
  getBaseFilePaths: string;
  setRendererStates: boolean;
  getRendererStates: RendererStates;
  getInfoFromID: IDInfo[K] | null;
  getInfoFromBgPath: PathInfo<K> | null;
  renameDataFolder: boolean;
  getProfiles: string[];
  moveDesktopIcon: boolean;
  swapDesktopIcons: boolean;
  editIconOffsetUpdate: boolean;
};

type UnsubscribeFunction = () => void;

interface Window {
  electron: {
    subscribeStatistics: (
      callback: (statistics: Statistics) => void
    ) => UnsubscribeFunction;
    getStaticData: () => Promise<StaticData>;
    subscribeChangeView: (
      callback: (view: View) => void
    ) => UnsubscribeFunction;
    sendHeaderAction: (payload: HeaderAction) => void;
    getDesktopIconData: (profile?: string) => Promise<DesktopIconData>;
    getSafeFileUrl: (relativePath: string) => string;
    ensureProfileFolder: (
      profile: string,
      copyFromProfile?: string
    ) => Promise<boolean>;
    ensureDataFolder: (id: string) => Promise<boolean>;
    ensureUniqueIconId: (name: string) => Promise<string | null>;
    saveIconData: (icon: DesktopIcon) => Promise<boolean>;
    renameID: (oldId: string, newId: string) => Promise<boolean>;
    sendSubWindowAction: (action: SubWindowAction, title: string) => void;
    getDesktopIcon: (id: string) => Promise<DesktopIcon | null>;
    getSubWindowTitle: () => Promise<string>;
    reloadIcon: (id: string) => Promise<boolean>;
    openSettings: () => Promise<boolean>;
    openBackgroundSelect: (id?: string) => Promise<boolean>;
    editIcon: (id: string, row: number, col: number) => Promise<boolean>;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    off: (channel: string, callback: (...args: unknown[]) => void) => void;
    subWindowFocus: () => Promise<boolean>;
    reloadWindow: () => Promise<boolean>;
    logMessage: (level: string, file: string, message: string) => void;
    logVideoMessage: (level: string, file: string, message: string) => void;
    openFileDialog: (
      type: string,
      appDataFilePath?: string
    ) => Promise<string | null>;
    saveIconImage: (sourcePath: string, id: string) => Promise<string>;
    saveToBackgroundIDFile: (
      id: string,
      sourcePath: string,
      saveFile: boolean
    ) => Promise<string>;
    launchProgram: (id: string) => Promise<boolean>;
    launchWebsite: (id: string) => Promise<boolean>;
    getFilePath: (file: File) => string;
    getFileType: (filepath: string) => Promise<string>;
    deleteIcon: (id: string) => Promise<boolean>;
    deleteIconData: (id: string) => Promise<boolean>;
    openInExplorer: (
      type: "image" | "programLink" | "background",
      filePath: string
    ) => Promise<boolean>;
    showSmallWindow: (
      title: string,
      message: string,
      buttons: string[]
    ) => Promise<string>;
    sendButtonResponse: (payload: {
      windowId: number;
      buttonText: string | null;
    }) => void;
    previewIconUpdate: (
      id: string,
      updates: Partial<DesktopIcon>
    ) => Promise<boolean>;
    previewBackgroundUpdate: (
      updates: Partial<PreviewBackgroundUpdate>
    ) => Promise<boolean>;
    previewGridUpdate: (updates: Partial<SettingsData>) => Promise<boolean>;
    previewHeaderUpdate: (updates: Partial<SettingsData>) => Promise<boolean>;
    getSettingsData: () => Promise<SettingsData>;
    saveSettingsData: (settings: SettingsData) => Promise<boolean>;
    getSetting<T extends SettingKey>(key: T): Promise<SettingsData[T]>;
    convertToVideoFileUrl: (filePath: string) => Promise<string | null>;
    getBackgroundImagePath: (filePath: string) => Promise<string | null>;
    reloadBackground: () => Promise<boolean>;
    reloadGrid: () => Promise<boolean>;
    reloadHeader: () => Promise<boolean>;
    getVideoMetadata: (filePath: string) => Promise<VideoMetadata>;
    generateIcon: (
      id: string,
      programLink: string,
      webLink: string
    ) => Promise<string[]>;
    selectIconFromList: (
      title: string,
      images: string[],
      id: string,
      row: number,
      col: number
    ) => Promise<string>;
    resetAllIconsFontColor: () => Promise<boolean>;
    getBackgroundIDs: () => Promise<string[]>;
    getBackgroundSummaries: (
      params?: GetBackgroundSummariesRequest
    ) => Promise<GetBackgroundSummariesResponse>;
    getBackgroundPageForId: (
      params: GetBackgroundPageForIdRequest
    ) => Promise<GetBackgroundPageForIdResponse>;
    resolveShortcut: (filePath: string) => Promise<string>;
    openEditBackground: (summary: BackgroundSummary) => Promise<boolean>;
    getBgJson: (id: string) => Promise<BgJson | null>;
    saveBgJson: (data: BackgroundSummary) => Promise<boolean>;
    deleteBackground: (id: string) => Promise<boolean>;
    addLocalTag: (tag: localTag) => Promise<boolean>;
    updateLocalTag: (name: string, tag: LocalTag) => Promise<boolean>;
    deleteLocalTag: (name: string) => Promise<boolean>;
    getLocalCategories: () => Promise<string[]>;
    renameCategory: (oldName: string, newName: string) => Promise<boolean>;
    deleteCategory: (name: string) => Promise<boolean>;
    renameLocalTag: (oldName: string, newName: string) => Promise<boolean>;
    indexBackgrounds: (options?: {
      newExternalPathAdded?: boolean;
      newDefaultPathAdded?: boolean;
    }) => Promise<number, number>;
    changeBackgroundDirectory: (
      id: string,
      targetLocation: string
    ) => Promise<string | null>;
    getBaseFilePaths: (name?: string) => Promise<string>;
    setRendererStates: (updates: RendererStates) => Promise<boolean>;
    getRendererStates: () => Promise<RendererStates>;
    getInfoFromID: <K extends InfoKey>(
      id: string,
      type: K
    ) => Promise<IDInfo[K] | null>;
    getInfoFromBgPath: <K extends PathKey>(
      path: string,
      key: K
    ) => Promise<PathInfo<K> | null>;
    renameDataFolder: (
      oldFolder: string,
      newFolder: string
    ) => Promise<boolean>;
    getProfiles: () => Promise<string[]>;
    moveDesktopIcon: (
      id: string,
      newRow: number,
      newCol: number,
      offsetReset?: boolean
    ) => Promise<boolean>;
    swapDesktopIcons: (id1: string, id2: string) => Promise<boolean>;
    editIconOffsetUpdate: (offsetX: number, offsetY: number) => void;
  };
}
