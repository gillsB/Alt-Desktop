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
  | "DISABLE_SUBWINDOW_DEVTOOLS";

type SubWindowAction = "EDIT_ICON" | "CLOSE_SUBWINDOW";

type DesktopIconData = {
  icons: DesktopIcon[];
};

type SettingsData = {
  videoBackground: string;
  imageBackground: string;
  fontSize?: number;
};

type SettingKey = keyof SettingsData;

type DesktopIcon = {
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

// Items/objects being sent from the renderer to the main process
interface EventParamMapping {
  statistics: [];
  getStaticData: [];
  changeView: [];
  sendHeaderAction: [HeaderAction];
  getDesktopIconData: [];
  ensureDataFolder: [number, number];
  setIconData: [DesktopIcon];
  sendSubWindowAction: [SubWindowAction, DesktopIcon?];
  getDesktopIcon: [number, number];
  reloadIcon: [number, number];
  openSettings: [];
  editIcon: [number, number];
  reloadWindow: [];
  openFileDialog: [string, string?];
  saveIconImage: [string, number, number];
  saveBackgroundImage: [string];
  launchProgram: [number, number];
  launchWebsite: [number, number];
  getFilePath: [File];
  getFileType: [string];
  deleteIcon: [number, number];
  openInExplorer: ["image" | "programLink", string];
  showSmallWindow: [string, string, string[]];
  previewIconUpdate: [number, number, Partial<DesktopIcon>];
  previewBackgroundUpdate: [Partial<SettingsData>];
  isSubWindowActive: [];
  getSettingsData: [];
  saveSettingsData: [SettingsData];
  getSetting: [SettingKey];
  convertToVideoFileUrl: [string];
  getBackgroundImagePath: [string];
  reloadBackground: [];
  getVideoMetadata: [string];
}

// The returns from the main process to the renderer
type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  changeView: View;
  sendHeaderAction: HeaderAction;
  getDesktopIconData: DesktopIconData;
  ensureDataFolder: boolean;
  setIconData: boolean;
  sendSubWindowAction: { action: SubWindowAction; icon?: DesktopIcon };
  getDesktopIcon: DesktopIcon | null;
  reloadIcon: boolean;
  openSettings: boolean;
  editIcon: boolean;
  reloadWindow: boolean;
  openFileDialog: string | null;
  saveIconImage: string;
  saveBackgroundImage: string;
  launchProgram: boolean;
  launchWebsite: boolean;
  getFilePath: string;
  getFileType: string;
  deleteIcon: boolean;
  openInExplorer: boolean;
  showSmallWindow: string;
  buttonResponse: { windowId: number; buttonText: string | null };
  previewIconUpdate: boolean;
  previewBackgroundUpdate: boolean;
  isSubWindowActive: boolean;
  getSettingsData: SettingsData;
  saveSettingsData: boolean;
  getSetting: SettingsData[SettingKey];
  convertToVideoFileUrl: string | null;
  getBackgroundImagePath: string | null;
  reloadBackground: boolean;
  getVideoMetadata: VideoMetadata;
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
    getDesktopIconData: () => Promise<DesktopIconData>;
    getSafeFileUrl: (relativePath: string) => string;
    ensureDataFolder: (row: number, col: number) => Promise<boolean>;
    setIconData: (icon: DesktopIcon) => Promise<boolean>;
    sendSubWindowAction: (action: SubWindowAction, icon?: DesktopIcon) => void;
    getDesktopIcon: (row: number, col: number) => Promise<DesktopIcon | null>;
    isSubWindowActive: () => Promise<boolean>;
    reloadIcon: (row: number, col: number) => Promise<boolean>;
    openSettings: () => Promise<boolean>;
    editIcon: (row: number, col: number) => Promise<boolean>;
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
    saveIconImage: (
      sourcePath: string,
      row: number,
      col: number
    ) => Promise<string>;
    saveBackgroundImage: (sourcePath: string) => Promise<string>;
    launchProgram: (row: number, col: number) => Promise<boolean>;
    launchWebsite: (row: number, col: number) => Promise<boolean>;
    getFilePath: (file: File) => string;
    getFileType: (filepath: string) => Promise<string>;
    deleteIcon: (row: number, col: number) => Promise<boolean>;
    openInExplorer: (
      type: "image" | "programLink",
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
      row: number,
      col: number,
      updates: Partial<DesktopIcon>
    ) => Promise<boolean>;
    previewBackgroundUpdate: (
      updates: Partial<SettingsData>
    ) => Promise<boolean>;
    getSettingsData: () => Promise<SettingsData>;
    saveSettingsData: (settings: SettingsData) => Promise<boolean>;
    getSetting<T extends SettingKey>(key: T): Promise<SettingsData[T]>;
    convertToVideoFileUrl: (filePath: string) => Promise<string | null>;
    getBackgroundImagePath: (filePath: string) => Promise<string | null>;
    reloadBackground: () => Promise<boolean>;
    getVideoMetadata: (filePath: string) => Promise<VideoMetadata>;
  };
}
