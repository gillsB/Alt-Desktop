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

type DesktopIconData = {
  icons: DesktopIcon[];
};

interface EventParamMapping {
  statistics: [];
  getStaticData: [];
  changeView: [];
  sendHeaderAction: [HeaderAction];
  getDesktopIconData: [];
  ensureDataFolder: [number, number];
  setIconData: [number, number, DesktopIcon];
}

type EventPayloadMapping = {
  statistics: Statistics;
  getStaticData: StaticData;
  changeView: View;
  sendHeaderAction: HeaderAction;
  getDesktopIconData: DesktopIconData;
  ensureDataFolder: boolean;
  setIconData: boolean;
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
    setIconData: (
      row: number,
      col: number,
      icon: DesktopIcon
    ) => Promise<boolean>;
  };
}
