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

type HeaderAction = "MINIMIZE" | "MAXIMIZE" | "CLOSE" | "SHOW_DEVTOOLS";

type SubWindowAction = "EDIT_ICON" | "CLOSE_SUBWINDOW";

type DesktopIconData = {
  icons: DesktopIcon[];
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
  getSubWindowState: [];
  reloadIcon: [number, number];
  editIcon: [number, number];
  reloadWindow: [];
  openFileDialog: [string];
  saveIconImage: [string, number, number];
  launchProgram: [number, number];
  launchWebsite: [number, number];
  getFilePath: [File];
  getFileType: [string];
  deleteIcon: [number, number];
  openInExplorer: ["image" | "programLink", string];
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
  getSubWindowState: boolean;
  reloadIcon: boolean;
  editIcon: boolean;
  reloadWindow: boolean;
  openFileDialog: string | null;
  saveIconImage: string;
  launchProgram: boolean;
  launchWebsite: boolean;
  getFilePath: string;
  getFileType: string;
  deleteIcon: boolean;
  openInExplorer: boolean;
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
    editIcon: (row: number, col: number) => Promise<boolean>;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    off: (channel: string, callback: (...args: unknown[]) => void) => void;
    reloadWindow: () => Promise<boolean>;
    logMessage: (level: string, file: string, message: string) => void;
    openFileDialog: (string) => Promise<string | null>;
    saveIconImage: (
      sourcePath: string,
      row: number,
      col: number
    ) => Promise<string>;
    launchProgram: (row: number, col: number) => Promise<boolean>;
    launchWebsite: (row: number, col: number) => Promise<boolean>;
    getFilePath: (file: File) => string;
    getFileType: (filepath: string) => Promise<string>;
    deleteIcon: (row: number, col: number) => Promise<boolean>;
    openInExplorer: (
      type: "image" | "programLink",
      filePath: string
    ) => Promise<boolean>;
  };
}
